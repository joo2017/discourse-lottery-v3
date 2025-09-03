# ====================================================================
# 修复 lib/lottery_creator.rb - 增强数据验证和错误处理
# ====================================================================

class LotteryCreator
  attr_reader :topic, :data, :user, :post

  def initialize(topic, lottery_data, user)
    @topic = topic
    @data = lottery_data.with_indifferent_access
    @user = user
    @post = topic.first_post
  end

  def create
    Rails.logger.info "LotteryCreator: Starting creation for topic #{topic.id}"
    Rails.logger.debug "LotteryCreator: Data received: #{data.inspect}"
    
    # 关键修复：增强的数据验证链
    validate_prerequisites!
    validate_data!
    determine_lottery_type!
    
    ActiveRecord::Base.transaction do
      lottery = create_lottery_record!
      add_lottery_tag!
      update_post_and_topic_data!(lottery)
      
      Rails.logger.info "LotteryCreator: Successfully created lottery #{lottery.id}"
      return lottery
    end
  rescue => e
    Rails.logger.error "LotteryCreator: Creation failed: #{e.message}"
    Rails.logger.error "LotteryCreator: Backtrace: #{e.backtrace&.join("\n")}"
    raise e
  end

  def update_existing(existing_lottery)
    Rails.logger.info "LotteryCreator: Updating existing lottery #{existing_lottery.id}"
    
    unless existing_lottery.in_regret_period?
      raise "抽奖已过编辑期限，无法修改"
    end

    validate_data!
    determine_lottery_type!
    
    ActiveRecord::Base.transaction do
      # 动态更新，只更新存在的字段
      update_attributes = {
        prize_name: data[:prize_name],
        prize_details: data[:prize_details],
        draw_time: parse_draw_time,
        winners_count: @winners_count,
        min_participants: data[:min_participants].to_i,
        lottery_type: @lottery_type,
        specified_post_numbers: @specified_post_numbers
      }
      
      # 检查字段是否存在再添加
      if existing_lottery.respond_to?(:additional_notes=)
        update_attributes[:additional_notes] = data[:additional_notes]&.strip
      end
      
      if existing_lottery.respond_to?(:prize_image=)
        update_attributes[:prize_image] = data[:prize_image]&.strip
      end
      
      if existing_lottery.respond_to?(:backup_strategy=)
        update_attributes[:backup_strategy] = data[:backup_strategy] || 'continue'
      end
      
      existing_lottery.update!(update_attributes)
      update_post_and_topic_data!(existing_lottery)
      
      Rails.logger.info "LotteryCreator: Successfully updated lottery #{existing_lottery.id}"
      return existing_lottery
    end
  end

  private

  def validate_prerequisites!
    unless SiteSetting.lottery_enabled
      raise "抽奖功能已关闭"
    end

    unless topic.present?
      raise "无效的主题"
    end

    unless post.present?
      raise "无法找到主题的首个帖子"
    end

    # 检查分类权限
    allowed_categories = SiteSetting.lottery_allowed_categories
    if allowed_categories.present?
      allowed_ids = allowed_categories.split('|').map(&:to_i)
      unless allowed_ids.include?(topic.category_id)
        raise "当前分类不支持抽奖功能"
      end
    end

    # 检查是否已存在抽奖
    if topic.lotteries.exists? && topic.lotteries.first.running?
      raise "该主题已存在进行中的抽奖活动"
    end
    
    # 关键修复：检查用户权限
    unless user.present? && user.active?
      raise "用户状态无效"
    end
  end

  def validate_data!
    Rails.logger.debug "LotteryCreator: Validating data"
    
    # 关键修复：确保数据不为空
    if data.blank? || !data.respond_to?(:keys)
      raise "抽奖数据为空或格式错误"
    end
    
    required_fields = {
      'prize_name' => '活动名称',
      'prize_details' => '奖品说明', 
      'draw_time' => '开奖时间'
    }
    
    missing_fields = required_fields.select { |key, _| data[key].blank? }
    if missing_fields.any?
      field_names = missing_fields.values.join('、')
      raise "缺少必填字段：#{field_names}"
    end

    validate_field_length!
    validate_min_participants!
    validate_draw_time!
  end

  def validate_field_length!
    if data[:prize_name]&.length.to_i > 100
      raise "活动名称不能超过100个字符"
    end

    if data[:prize_details]&.length.to_i > 500
      raise "奖品说明不能超过500个字符"
    end

    if data[:additional_notes].present? && data[:additional_notes].length > 300
      raise "补充说明不能超过300个字符"
    end
  end

  def validate_min_participants!
    global_min = SiteSetting.lottery_min_participants_global
    min_participants = data[:min_participants].to_i
    
    if min_participants < 1
      raise "参与门槛必须至少为1人"
    end
    
    if min_participants < global_min
      raise "参与门槛不能低于全局设置的#{global_min}人"
    end

    if min_participants > 1000
      raise "参与门槛不能超过1000人"
    end
  end

  def validate_draw_time!
    draw_time = parse_draw_time
    
    if draw_time <= Time.current
      raise "开奖时间必须是未来时间"
    end

    if draw_time > 1.year.from_now
      raise "开奖时间不能超过一年"
    end
  end

  def parse_draw_time
    @parsed_draw_time ||= begin
      time_str = data[:draw_time].to_s.strip
      
      return nil if time_str.blank?
      
      begin
        if time_str.match?(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
          DateTime.parse(time_str)
        elsif time_str.match?(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
          DateTime.parse(time_str)
        else
          DateTime.parse(time_str)
        end
      rescue ArgumentError => e
        raise "开奖时间格式无效：#{e.message}"
      end
    end
  end

  def determine_lottery_type!
    if data[:specified_posts].present? && data[:specified_posts].strip.present?
      @lottery_type = 'specified'
      
      posts_str = data[:specified_posts].strip
      begin
        posts = posts_str.split(',').map(&:strip).map(&:to_i).select { |n| n > 1 }
        
        if posts.empty?
          raise "指定楼层格式错误，请使用逗号分隔的数字"
        end
        
        if posts != posts.uniq
          raise "指定楼层不能包含重复数字"
        end
        
        @specified_post_numbers = posts.join(',')
        @winners_count = posts.length
        
      rescue => e
        raise "指定楼层解析失败：#{e.message}"
      end
    else
      @lottery_type = 'random'
      @specified_post_numbers = nil
      
      winners_count = data[:winners_count].to_i
      if winners_count < 1
        @winners_count = 1
      elsif winners_count > 100
        raise "获奖人数不能超过100人"
      else
        @winners_count = winners_count
      end
    end
  end

  def create_lottery_record!
    Rails.logger.debug "LotteryCreator: Creating lottery record"
    
    # 基础属性（所有版本都有的字段）
    base_attributes = {
      topic_id: topic.id,
      post_id: post.id,
      user_id: user.id,
      prize_name: data[:prize_name].strip,
      prize_details: data[:prize_details].strip,
      draw_time: parse_draw_time,
      winners_count: @winners_count,
      min_participants: data[:min_participants].to_i,
      backup_strategy: data[:backup_strategy] || 'continue',
      lottery_type: @lottery_type,
      specified_post_numbers: @specified_post_numbers,
      status: 'running'
    }
    
    # 检查可选字段是否存在，存在才添加
    if Lottery.column_names.include?('additional_notes')
      base_attributes[:additional_notes] = data[:additional_notes]&.strip
    end
    
    if Lottery.column_names.include?('prize_image')
      base_attributes[:prize_image] = data[:prize_image]&.strip
    end
    
    lottery = Lottery.create!(base_attributes)
    
    Rails.logger.info "LotteryCreator: Created lottery record with ID #{lottery.id}"
    lottery
  end

  def add_lottery_tag!
    begin
      lottery_tag = Tag.find_or_create_by!(name: '抽奖中') do |tag|
        tag.target_tag_id = nil
        tag.public_topic_count = 0
      end
      
      unless topic.tags.include?(lottery_tag)
        topic.tags << lottery_tag
        topic.save!
      end
      
      Rails.logger.debug "LotteryCreator: Added lottery tag"
    rescue => e
      Rails.logger.warn "LotteryCreator: Failed to add tag: #{e.message}"
    end
  end

  def update_post_and_topic_data!(lottery)
    Rails.logger.debug "LotteryCreator: Updating post and topic data"
    
    begin
      # 构建显示数据，只包含实际存在的字段
      lottery_display_data = {
        id: lottery.id,
        prize_name: lottery.prize_name,
        prize_details: lottery.prize_details,
        draw_time: lottery.draw_time.iso8601,
        winners_count: lottery.winners_count,
        min_participants: lottery.min_participants,
        backup_strategy: lottery.backup_strategy,
        lottery_type: lottery.lottery_type,
        specified_posts: lottery.specified_post_numbers,
        status: lottery.status
      }
      
      # 安全地添加可选字段
      if lottery.respond_to?(:additional_notes) && lottery.additional_notes.present?
        lottery_display_data[:additional_notes] = lottery.additional_notes
      end
      
      if lottery.respond_to?(:prize_image) && lottery.prize_image.present?
        lottery_display_data[:prize_image] = lottery.prize_image
      end
      
      # 使用官方推荐的方式设置自定义字段
      topic.lottery_data = lottery_display_data
      topic.save_custom_fields(true)
      
      post.custom_fields['lottery_data'] = lottery_display_data.to_json
      post.save_custom_fields(true)
      
      Rails.logger.info "LotteryCreator: Updated custom fields successfully"
      
    rescue => e
      Rails.logger.error "LotteryCreator: Failed to update custom fields: #{e.message}"
      # 不抛出异常，因为核心记录已创建成功
    end
  end
end

# ====================================================================
# 修复 lib/lottery_manager.rb - 增强参与者计算的可靠性
# ====================================================================

class LotteryManager
  attr_reader :lottery

  def initialize(lottery)
    @lottery = lottery
  end

  def execute_draw
    Rails.logger.info "LotteryManager: Starting draw for lottery #{lottery.id}"
    
    # 状态检查
    unless lottery.can_draw?
      Rails.logger.warn "LotteryManager: Lottery #{lottery.id} cannot be drawn (status: #{lottery.status})"
      return { success: false, reason: 'lottery_not_ready' }
    end

    ActiveRecord::Base.transaction do
      # 计算有效参与者 - 关键修复：使用更可靠的方法
      participants = calculate_valid_participants_safely
      participant_count = participants.count
      
      Rails.logger.info "LotteryManager: Found #{participant_count} valid participants (required: #{lottery.min_participants})"

      # 判断是否满足参与门槛
      if participant_count >= lottery.min_participants
        # 执行开奖
        result = execute_actual_draw(participants)
        
        if result[:success]
          # 发布中奖公告
          publish_winner_announcement(result[:winners])
          
          # 发送私信通知
          send_winner_notifications(result[:winners])
          
          # 更新标签
          update_topic_tag('已开奖')
          
          # 锁定主题
          lock_topic
          
          Rails.logger.info "LotteryManager: Successfully completed draw for lottery #{lottery.id}"
          return { success: true, winners: result[:winners], participants: participant_count }
        else
          return result
        end
      else
        # 参与人数不足，根据策略处理
        Rails.logger.info "LotteryManager: Insufficient participants, applying backup strategy: #{lottery.backup_strategy}"
        
        if lottery.should_continue_with_insufficient_participants?
          # 继续开奖
          result = execute_actual_draw(participants)
          
          if result[:success]
            publish_insufficient_but_continued_announcement(result[:winners], participant_count)
            send_winner_notifications(result[:winners])
            update_topic_tag('已开奖')
            lock_topic
            
            Rails.logger.info "LotteryManager: Completed draw with insufficient participants"
            return { success: true, winners: result[:winners], participants: participant_count, insufficient: true }
          else
            return result
          end
        else
          # 取消活动
          cancel_lottery(participant_count)
          
          Rails.logger.info "LotteryManager: Cancelled lottery due to insufficient participants"
          return { success: true, cancelled: true, participants: participant_count }
        end
      end
    end
  rescue => e
    Rails.logger.error "LotteryManager: Draw failed for lottery #{lottery.id}: #{e.message}"
    Rails.logger.error "LotteryManager: #{e.backtrace.join("\n")}"
    
    # 标记为失败状态
    begin
      lottery.update!(status: 'cancelled')
    rescue => update_error
      Rails.logger.error "LotteryManager: Failed to update lottery status: #{update_error.message}"
    end
    
    return { success: false, reason: 'execution_error', error: e.message }
  end

  private

  # 关键修复：使用分步骤的安全方法计算参与者
  def calculate_valid_participants_safely
    Rails.logger.debug "LotteryManager: Calculating valid participants safely"
    
    begin
      # 步骤1：获取基础符合条件的帖子
      base_posts = get_base_eligible_posts
      Rails.logger.debug "LotteryManager: Found #{base_posts.count} base eligible posts"
      
      # 步骤2：排除特定用户组成员
      filtered_posts = exclude_restricted_groups(base_posts)
      Rails.logger.debug "LotteryManager: After group filtering: #{filtered_posts.count} posts"
      
      # 步骤3：用户去重并构建参与者列表
      participants = build_participant_list(filtered_posts)
      Rails.logger.debug "LotteryManager: Final participant count: #{participants.length}"
      
      participants
      
    rescue => e
      Rails.logger.error "LotteryManager: Error in participant calculation: #{e.message}"
      Rails.logger.error "LotteryManager: Using fallback method"
      
      # 超级简化的备用方法
      fallback_participants
    end
  end

  def get_base_eligible_posts
    lottery.topic.posts
           .where.not(post_number: 1)                    # 排除主楼层
           .where.not(user_id: lottery.user_id)          # 排除发起者
           .where(deleted_at: nil)                       # 排除已删除帖子
           .where(hidden: false)                         # 排除隐藏帖子
           .joins(:user)                                 # 关联用户表
           .where(users: { active: true, suspended_till: nil }) # 只包含正常用户
           .includes(:user)                              # 预加载用户数据
           .order(:created_at)                           # 按时间排序
  end

  def exclude_restricted_groups(posts)
    excluded_groups_setting = SiteSetting.lottery_excluded_groups || ""
    excluded_group_ids = excluded_groups_setting.split('|')
                                               .map(&:strip)
                                               .map(&:to_i)
                                               .select { |id| id > 0 }
    
    return posts if excluded_group_ids.empty?
    
    # 获取被排除用户组的用户ID
    excluded_user_ids = GroupUser.where(group_id: excluded_group_ids).pluck(:user_id).uniq
    
    if excluded_user_ids.any?
      posts.where.not(user_id: excluded_user_ids)
    else
      posts
    end
  end

  def build_participant_list(posts)
    # 用户去重：每个用户只取最早的一个有效帖子
    user_first_posts = {}
    
    posts.each do |post|
      user_id = post.user_id
      unless user_first_posts.key?(user_id)
        user_first_posts[user_id] = {
          user: post.user,
          post_number: post.post_number,
          created_at: post.created_at
        }
      end
    end
    
    # 构造参与者列表，添加临时属性用于后续处理
    participants = user_first_posts.values.map do |data|
      user = data[:user]
      # 为用户对象添加临时属性
      user.define_singleton_method(:post_number) { data[:post_number] }
      user.define_singleton_method(:participation_time) { data[:created_at] }
      user
    end
    
    # 按参与时间排序
    participants.sort_by(&:participation_time)
  end

  def fallback_participants
    Rails.logger.warn "LotteryManager: Using ultra-simple fallback method"
    
    begin
      simple_posts = lottery.topic.posts
                           .where.not(post_number: 1)
                           .where.not(user_id: lottery.user_id)
                           .where(deleted_at: nil)
                           .includes(:user)
                           .order(:created_at)
      
      # 简单去重
      seen_users = Set.new
      simple_participants = []
      
      simple_posts.each do |post|
        user = post.user
        next if seen_users.include?(user.id)
        next unless user&.active
        
        seen_users.add(user.id)
        user.define_singleton_method(:post_number) { post.post_number }
        user.define_singleton_method(:participation_time) { post.created_at }
        simple_participants << user
      end
      
      Rails.logger.debug "LotteryManager: Fallback method found #{simple_participants.length} participants"
      simple_participants
      
    rescue => fallback_error
      Rails.logger.error "LotteryManager: Even fallback method failed: #{fallback_error.message}"
      # 返回空数组，让上层处理
      []
    end
  end

  def execute_actual_draw(participants)
    Rails.logger.debug "LotteryManager: Executing actual draw"
    
    if lottery.specified_type?
      return execute_specified_draw(participants)
    else
      return execute_random_draw(participants)
    end
  end

  def execute_random_draw(participants)
    Rails.logger.debug "LotteryManager: Executing random draw"
    
    participants_array = participants.to_a
    available_count = participants_array.length
    
    if available_count == 0
      lottery.update!(status: 'cancelled')
      return { success: false, reason: 'no_participants' }
    end

    # 确定实际中奖人数
    actual_winners_count = [lottery.winners_count, available_count].min
    
    # 随机选择中奖者
    winners = participants_array.sample(actual_winners_count)
    
    # 保存中奖结果
    winner_ids = winners.map(&:id).join(',')
    lottery.update!(
      status: 'finished',
      winner_user_ids: winner_ids
    )
    
    Rails.logger.info "LotteryManager: Random draw completed, #{winners.length} winners selected"
    
    { success: true, winners: winners }
  end

  def execute_specified_draw(participants)
    Rails.logger.debug "LotteryManager: Executing specified draw"
    
    specified_numbers = lottery.specified_post_numbers_array
    participants_by_post = {}
    
    # 建立楼层号到参与者的映射
    participants.each do |participant|
      post_number = participant.respond_to?(:post_number) ? participant.post_number : nil
      participants_by_post[post_number] = participant if post_number
    end
    
    Rails.logger.debug "LotteryManager: Participant post mapping: #{participants_by_post.keys}"
    
    winners = []
    valid_numbers = []
    
    # 检查每个指定楼层
    specified_numbers.each do |post_number|
      if participants_by_post[post_number]
        winners << participants_by_post[post_number]
        valid_numbers << post_number
        Rails.logger.debug "LotteryManager: Found valid participant for post #{post_number}"
      else
        Rails.logger.warn "LotteryManager: Specified post #{post_number} not found or invalid"
      end
    end
    
    if winners.empty?
      # 所有指定楼层都无效，取消抽奖
      lottery.update!(status: 'cancelled')
      Rails.logger.warn "LotteryManager: All specified posts invalid, cancelling"
      return { success: false, reason: 'all_specified_invalid' }
    end
    
    # 保存中奖结果
    winner_ids = winners.map(&:id).join(',')
    lottery.update!(
      status: 'finished',
      winner_user_ids: winner_ids,
      specified_post_numbers: valid_numbers.join(',')  # 更新为实际有效的楼层
    )
    
    Rails.logger.info "LotteryManager: Specified draw completed, #{winners.length}/#{specified_numbers.length} winners selected"
    
    { success: true, winners: winners }
  end

  def publish_winner_announcement(winners)
    Rails.logger.debug "LotteryManager: Publishing winner announcement"
    
    announcement = build_winner_announcement(winners)
    
    begin
      PostCreator.create!(
        Discourse.system_user,
        topic_id: lottery.topic_id,
        raw: announcement
      )
    rescue => e
      Rails.logger.error "LotteryManager: Failed to publish winner announcement: #{e.message}"
      raise e
    end
  end

  def publish_insufficient_but_continued_announcement(winners, actual_count)
    Rails.logger.debug "LotteryManager: Publishing insufficient but continued announcement"
    
    announcement = "## 🎉 开奖结果\n\n"
    announcement += "**活动名称：** #{lottery.prize_name}\n"
    announcement += "**开奖时间：** #{format_time(lottery.draw_time)}\n\n"
    announcement += "⚠️ **特别说明：** 实际参与人数为 #{actual_count} 人，少于设定门槛 #{lottery.min_participants} 人，但根据活动设置继续开奖。\n\n"
    
    if lottery.specified_type?
      announcement += "**中奖方式：** 指定楼层\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        post_number = lottery.specified_post_numbers_array[index]
        announcement += "- #{post_number}楼：@#{winner.username}\n"
      end
    else
      announcement += "**中奖方式：** 随机抽取\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        announcement += "#{index + 1}. @#{winner.username}\n"
      end
    end
    
    announcement += "\n---\n\n"
    announcement += "🎊 恭喜以上中奖者！请及时联系活动发起者领取奖品。"
    
    begin
      PostCreator.create!(
        Discourse.system_user,
        topic_id: lottery.topic_id,
        raw: announcement
      )
    rescue => e
      Rails.logger.error "LotteryManager: Failed to publish insufficient announcement: #{e.message}"
      raise e
    end
  end

  def build_winner_announcement(winners)
    announcement = "## 🎉 开奖结果\n\n"
    announcement += "**活动名称：** #{lottery.prize_name}\n"
    announcement += "**开奖时间：** #{format_time(lottery.draw_time)}\n"
    
    # 重新计算参与人数（简化版本，避免复杂查询）
    participant_count = begin
      calculate_valid_participants_safely.count
    rescue => e
      Rails.logger.warn "LotteryManager: Could not recalculate participant count: #{e.message}"
      "未知"
    end
    
    announcement += "**参与人数：** #{participant_count} 人\n\n"
    
    if lottery.specified_type?
      announcement += "**中奖方式：** 指定楼层\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        # 从更新后的楼层列表获取
        post_numbers = lottery.specified_post_numbers_array
        post_number = post_numbers[index]
        announcement += "- #{post_number}楼：@#{winner.username}\n"
      end
    else
      announcement += "**中奖方式：** 随机抽取\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        announcement += "#{index + 1}. @#{winner.username}\n"
      end
    end
    
    announcement += "\n---\n\n"
    announcement += "🎊 恭喜以上中奖者！请及时联系活动发起者领取奖品。"
    
    announcement
  end

  def send_winner_notifications(winners)
    Rails.logger.debug "LotteryManager: Sending winner notifications"
    
    winners.each do |winner|
      begin
        PostCreator.create!(
          Discourse.system_user,
          title: "🎉 恭喜您中奖了！",
          raw: build_winner_notification_message(winner),
          target_usernames: winner.username,
          archetype: Archetype.private_message
        )
        
        Rails.logger.debug "LotteryManager: Sent notification to #{winner.username}"
      rescue => e
        Rails.logger.error "LotteryManager: Failed to send notification to #{winner.username}: #{e.message}"
        # 继续处理其他用户，不要因为一个用户的通知失败而停止整个流程
      end
    end
  end

  def build_winner_notification_message(winner)
    message = "恭喜您在抽奖活动中获奖！\n\n"
    message += "**活动名称：** #{lottery.prize_name}\n"
    message += "**奖品说明：** #{lottery.prize_details}\n"
    message += "**开奖时间：** #{format_time(lottery.draw_time)}\n"
    message += "**活动发起者：** @#{lottery.user.username}\n\n"
    message += "请及时联系活动发起者领取您的奖品。\n\n"
    
    begin
      message += "[点击查看抽奖主题](#{Discourse.base_url}/t/#{lottery.topic.slug}/#{lottery.topic_id})"
    rescue => e
      Rails.logger.warn "LotteryManager: Could not generate topic URL: #{e.message}"
      message += "[抽奖主题](#{Discourse.base_url}/t/#{lottery.topic_id})"
    end
    
    message
  end

  def cancel_lottery(participant_count)
    Rails.logger.debug "LotteryManager: Cancelling lottery"
    
    lottery.update!(status: 'cancelled')
    
    announcement = "## ❌ 活动取消\n\n"
    announcement += "**活动名称：** #{lottery.prize_name}\n"
    announcement += "**原定开奖时间：** #{format_time(lottery.draw_time)}\n"
    announcement += "**取消时间：** #{format_time(Time.current)}\n"
    announcement += "**取消原因：** 参与人数不足\n"
    announcement += "**需要人数：** #{lottery.min_participants} 人\n"
    announcement += "**实际人数：** #{participant_count} 人\n\n"
    announcement += "感谢大家的关注和参与，期待下次活动！"
    
    begin
      PostCreator.create!(
        Discourse.system_user,
        topic_id: lottery.topic_id,
        raw: announcement
      )
    rescue => e
      Rails.logger.error "LotteryManager: Failed to post cancellation announcement: #{e.message}"
      raise e
    end
    
    update_topic_tag('已取消')
  end

  def update_topic_tag(new_tag_name)
    Rails.logger.debug "LotteryManager: Updating topic tag to #{new_tag_name}"
    
    begin
      topic = lottery.topic
      
      # 移除旧的抽奖相关标签
      old_tags = ['抽奖中', '已开奖', '已取消']
      old_tags.each do |tag_name|
        begin
          tag = Tag.find_by(name: tag_name)
          if tag && topic.tags.include?(tag)
            topic.tags.delete(tag)
          end
        rescue => e
          Rails.logger.warn "LotteryManager: Error removing tag #{tag_name}: #{e.message}"
        end
      end
      
      # 添加新标签
      begin
        new_tag = Tag.find_or_create_by!(name: new_tag_name) do |tag|
          tag.target_tag_id = nil
          tag.public_topic_count = 0
        end
        topic.tags << new_tag unless topic.tags.include?(new_tag)
        
        topic.save!
        
        Rails.logger.debug "LotteryManager: Updated tag successfully"
      rescue => e
        Rails.logger.warn "LotteryManager: Error adding new tag: #{e.message}"
      end
    rescue => e
      Rails.logger.warn "LotteryManager: Failed to update topic tag: #{e.message}"
      # 不要因为标签更新失败而中断整个流程
    end
  end

  def lock_topic
    Rails.logger.debug "LotteryManager: Locking topic"
    
    begin
      topic = lottery.topic
      topic.update!(closed: true)
      
      Rails.logger.debug "LotteryManager: Topic locked successfully"
    rescue => e
      Rails.logger.warn "LotteryManager: Failed to lock topic: #{e.message}"
      # 不要因为锁定失败而中断整个流程
    end
  end

  def format_time(time)
    return '' unless time
    time.strftime('%Y年%m月%d日 %H:%M')
  rescue => e
    Rails.logger.warn "LotteryManager: Error formatting time: #{e.message}"
    time.to_s
  end
end
