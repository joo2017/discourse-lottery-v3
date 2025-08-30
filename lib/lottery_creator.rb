# lib/lottery_creator.rb
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
    
    # 前置检查
    validate_prerequisites!
    
    # 数据验证
    validate_data!
    
    # 智能判断抽奖方式
    determine_lottery_type!
    
    ActiveRecord::Base.transaction do
      # 创建抽奖记录
      lottery = create_lottery_record!
      
      # 添加标签
      add_lottery_tag!
      
      # 更新帖子和主题的自定义字段
      update_post_and_topic_data!(lottery)
      
      Rails.logger.info "LotteryCreator: Successfully created lottery #{lottery.id}"
      return lottery
    end
  rescue => e
    Rails.logger.error "LotteryCreator: Creation failed: #{e.message}"
    Rails.logger.debug "LotteryCreator: #{e.backtrace.join("\n")}"
    raise e
  end

  def update_existing(existing_lottery)
    Rails.logger.info "LotteryCreator: Updating existing lottery #{existing_lottery.id}"
    
    # 检查是否在可编辑期内
    unless existing_lottery.in_regret_period?
      raise "抽奖已过编辑期限，无法修改"
    end

    # 验证数据
    validate_data!
    determine_lottery_type!
    
    ActiveRecord::Base.transaction do
      # 更新抽奖记录
      existing_lottery.update!(
        prize_name: data[:prize_name],
        prize_details: data[:prize_details],
        draw_time: parse_draw_time,
        winners_count: @winners_count,
        min_participants: data[:min_participants].to_i,
        lottery_type: @lottery_type,
        specified_post_numbers: @specified_post_numbers,
        additional_notes: data[:additional_notes],
        prize_image: data[:prize_image]
      )
      
      # 更新帖子和主题数据
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
  end

  def validate_data!
    Rails.logger.debug "LotteryCreator: Validating data"
    
    # 检查必填字段
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

    # 验证字段长度
    validate_field_length!

    # 验证最小参与人数
    validate_min_participants!

    # 验证开奖时间
    validate_draw_time!
    
    Rails.logger.debug "LotteryCreator: Data validation passed"
  end

  def validate_field_length!
    if data[:prize_name].length > 100
      raise "活动名称不能超过100个字符"
    end

    if data[:prize_details].length > 500
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

    # 检查时间不能太远（比如不超过1年）
    if draw_time > 1.year.from_now
      raise "开奖时间不能超过一年"
    end
  end

  def parse_draw_time
    @parsed_draw_time ||= begin
      time_str = data[:draw_time].to_s.strip
      
      # 尝试解析时间
      begin
        if time_str.match?(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
          # HTML datetime-local 格式
          DateTime.parse(time_str)
        elsif time_str.match?(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
          # 标准格式
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
      
      # 解析并验证指定楼层
      posts_str = data[:specified_posts].strip
      begin
        posts = posts_str.split(',').map(&:strip).map(&:to_i).select { |n| n > 1 }
        
        if posts.empty?
          raise "指定楼层格式错误，请使用逗号分隔的数字，如：8,18,28"
        end
        
        if posts != posts.uniq
          raise "指定楼层不能包含重复数字"
        end
        
        @specified_post_numbers = posts.join(',')
        @winners_count = posts.length
        
        Rails.logger.debug "LotteryCreator: Determined type as 'specified' with posts: #{@specified_post_numbers}"
      rescue => e
        raise "指定楼层解析失败：#{e.message}"
      end
    else
      @lottery_type = 'random'
      @specified_post_numbers = nil
      
      # 验证获奖人数
      winners_count = data[:winners_count].to_i
      if winners_count < 1
        @winners_count = 1
      elsif winners_count > 100
        raise "获奖人数不能超过100人"
      else
        @winners_count = winners_count
      end
      
      Rails.logger.debug "LotteryCreator: Determined type as 'random' with #{@winners_count} winners"
    end
  end

  def create_lottery_record!
    Rails.logger.debug "LotteryCreator: Creating lottery record"
    
    lottery = Lottery.create!(
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
      additional_notes: data[:additional_notes]&.strip,
      prize_image: data[:prize_image]&.strip,
      status: 'running'
    )
    
    Rails.logger.info "LotteryCreator: Created lottery record with ID #{lottery.id}"
    lottery
  end

  def add_lottery_tag!
    begin
      # 创建或获取抽奖标签
      lottery_tag = Tag.find_or_create_by!(name: '抽奖中') do |tag|
        tag.target_tag_id = nil
        tag.public_topic_count = 0
      end
      
      # 添加标签到主题
      unless topic.tags.include?(lottery_tag)
        topic.tags << lottery_tag
        topic.save!
      end
      
      Rails.logger.debug "LotteryCreator: Added '抽奖中' tag"
    rescue => e
      Rails.logger.warn "LotteryCreator: Failed to add tag: #{e.message}"
      # 不要因为标签添加失败而终止整个流程
    end
  end

  def update_post_and_topic_data!(lottery)
    Rails.logger.debug "LotteryCreator: Updating post and topic data"
    
    begin
      # 构建结构化的抽奖显示数据
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
        status: lottery.status,
        additional_notes: lottery.additional_notes,
        prize_image: lottery.prize_image
      }
      
      # 使用官方推荐的方式设置自定义字段
      topic.lottery_data = lottery_display_data
      topic.save_custom_fields
      
      # 同时保存到 post 的自定义字段中
      post.custom_fields['lottery_data'] = lottery_display_data.to_json
      post.save_custom_fields
      
      Rails.logger.info "LotteryCreator: Updated post and topic custom fields"
      
    rescue => e
      Rails.logger.error "LotteryCreator: Failed to update custom fields: #{e.message}"
      # 继续执行，不要因为自定义字段更新失败而影响数据库保存
    end
  end
end
