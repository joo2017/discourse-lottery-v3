# lib/lottery_creator.rb - 修复版本
# 基于discourse-calendar的服务模式和错误处理最佳实践

class LotteryCreator
  include ActiveModel::Validations

  attr_reader :topic, :data, :user, :post, :errors_list

  def initialize(topic, lottery_data, user)
    @topic = topic
    @data = lottery_data.with_indifferent_access
    @user = user
    @post = topic.first_post
    @errors_list = []
    
    Rails.logger.info "🎲 LotteryCreator: Initializing for topic #{topic.id}"
  end

  def create
    Rails.logger.info "🎲 LotteryCreator: Starting creation process"
    
    begin
      validate_environment!
      validate_prerequisites!
      validate_lottery_data!
      determine_lottery_type!
      
      ActiveRecord::Base.transaction do
        lottery = create_lottery_record!
        update_topic_metadata!(lottery)
        schedule_background_tasks!(lottery)
        
        Rails.logger.info "🎲 LotteryCreator: Successfully created lottery #{lottery.id}"
        return lottery
      end
      
    rescue ValidationError => e
      Rails.logger.warn "🎲 LotteryCreator: Validation failed - #{e.message}"
      create_error_post(e.message)
      raise e
    rescue => e
      Rails.logger.error "🎲 LotteryCreator: Unexpected error - #{e.message}"
      Rails.logger.error "🎲 LotteryCreator: #{e.backtrace.join("\n")}"
      create_error_post("系统错误，请联系管理员")
      raise e
    end
  end

  def update_existing(existing_lottery)
    Rails.logger.info "🎲 LotteryCreator: Updating lottery #{existing_lottery.id}"
    
    begin
      unless existing_lottery.in_regret_period?
        raise ValidationError.new("抽奖已过编辑期限，无法修改")
      end

      validate_lottery_data!
      determine_lottery_type!
      
      ActiveRecord::Base.transaction do
        update_lottery_record!(existing_lottery)
        update_topic_metadata!(existing_lottery)
        reschedule_background_tasks!(existing_lottery)
        
        Rails.logger.info "🎲 LotteryCreator: Successfully updated lottery #{existing_lottery.id}"
        return existing_lottery
      end
      
    rescue ValidationError => e
      Rails.logger.warn "🎲 LotteryCreator: Update validation failed - #{e.message}"
      raise e
    rescue => e
      Rails.logger.error "🎲 LotteryCreator: Update error - #{e.message}"
      raise e
    end
  end

  private

  # 自定义异常类
  class ValidationError < StandardError; end

  def validate_environment!
    unless defined?(Lottery) && Lottery.table_exists?
      raise ValidationError.new("抽奖数据表不存在，请联系管理员")
    end
    
    unless SiteSetting.lottery_enabled
      raise ValidationError.new("抽奖功能已被管理员关闭")
    end
  end

  def validate_prerequisites!
    unless topic.present?
      raise ValidationError.new("无效的主题")
    end

    unless post.present?
      raise ValidationError.new("无法找到主题的首个帖子")
    end

    # 检查分类权限
    allowed_categories = SiteSetting.lottery_allowed_categories
    if allowed_categories.present?
      allowed_ids = allowed_categories.split('|').map(&:to_i).select { |id| id > 0 }
      unless allowed_ids.empty? || allowed_ids.include?(topic.category_id)
        raise ValidationError.new("当前分类不支持抽奖功能")
      end
    end

    # 检查是否已存在活跃抽奖
    if topic.lotteries.exists? && topic.lotteries.where(status: 'running').exists?
      raise ValidationError.new("该主题已存在进行中的抽奖活动")
    end

    # 检查用户权限
    unless user.present? && user.active?
      raise ValidationError.new("用户状态异常")
    end
  end

  def validate_lottery_data!
    Rails.logger.debug "🎲 LotteryCreator: Validating lottery data"
    
    # 必填字段验证
    required_fields = {
      'prize_name' => '活动名称',
      'prize_details' => '奖品说明', 
      'draw_time' => '开奖时间'
    }
    
    missing_fields = required_fields.select { |key, _| data[key].blank? }
    if missing_fields.any?
      field_names = missing_fields.values.join('、')
      raise ValidationError.new("缺少必填字段：#{field_names}")
    end

    # 字段长度验证
    validate_field_lengths!
    
    # 参与门槛验证
    validate_min_participants!
    
    # 开奖时间验证
    validate_draw_time!
    
    # 图片URL验证（如果提供）
    validate_prize_image! if data[:prize_image].present?
  end

  def validate_field_lengths!
    validations = [
      [:prize_name, 100, '活动名称'],
      [:prize_details, 500, '奖品说明'],
      [:additional_notes, 300, '补充说明']
    ]
    
    validations.each do |field, max_length, field_name|
      if data[field].present? && data[field].length > max_length
        raise ValidationError.new("#{field_name}不能超过#{max_length}个字符")
      end
    end
  end

  def validate_min_participants!
    global_min = SiteSetting.lottery_min_participants_global || 5
    min_participants = data[:min_participants].to_i
    
    if min_participants < 1
      raise ValidationError.new("参与门槛必须至少为1人")
    end
    
    if min_participants < global_min
      raise ValidationError.new("参与门槛不能低于全局设置的#{global_min}人")
    end

    if min_participants > 1000
      raise ValidationError.new("参与门槛不能超过1000人")
    end
  end

  def validate_draw_time!
    draw_time = parse_draw_time
    
    if draw_time <= Time.current
      raise ValidationError.new("开奖时间必须是未来时间")
    end

    if draw_time > 1.year.from_now
      raise ValidationError.new("开奖时间不能超过一年")
    end
    
    # 检查是否太接近当前时间（至少5分钟后）
    if draw_time < 5.minutes.from_now
      raise ValidationError.new("开奖时间至少应在5分钟后")
    end
  end

  def validate_prize_image!
    image_url = data[:prize_image].strip
    
    # 基本URL格式验证
    unless image_url.match?(/\Ahttps?:\/\/.+\.(jpg|jpeg|png|gif|webp)\z/i)
      raise ValidationError.new("奖品图片必须是有效的图片URL")
    end
    
    # 检查URL长度
    if image_url.length > 500
      raise ValidationError.new("图片URL过长")
    end
  end

  def parse_draw_time
    @parsed_draw_time ||= begin
      time_str = data[:draw_time].to_s.strip
      
      begin
        # 支持多种时间格式
        if time_str.match?(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
          DateTime.parse(time_str)
        elsif time_str.match?(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
          DateTime.parse(time_str)
        else
          DateTime.parse(time_str)
        end
      rescue ArgumentError => e
        raise ValidationError.new("开奖时间格式无效：#{e.message}")
      end
    end
  end

  def determine_lottery_type!
    if data[:specified_posts].present? && data[:specified_posts].strip.present?
      @lottery_type = 'specified'
      
      posts_str = data[:specified_posts].strip
      begin
        # 解析楼层号
        posts = posts_str.split(/[,，]/).map(&:strip).map(&:to_i).select { |n| n > 1 }
        
        if posts.empty?
          raise ValidationError.new("指定楼层格式错误，请使用逗号分隔的数字（楼层号必须大于1）")
        end
        
        if posts != posts.uniq
          raise ValidationError.new("指定楼层不能包含重复数字")
        end
        
        # 检查楼层数量限制
        max_specified = SiteSetting.lottery_max_specified_posts || 20
        if posts.length > max_specified
          raise ValidationError.new("指定楼层数量不能超过#{max_specified}个")
        end
        
        @specified_post_numbers = posts.join(',')
        @winners_count = posts.length
        
      rescue ValidationError
        raise
      rescue => e
        raise ValidationError.new("指定楼层解析失败：#{e.message}")
      end
    else
      @lottery_type = 'random'
      @specified_post_numbers = nil
      
      winners_count = data[:winners_count].to_i
      max_winners = SiteSetting.lottery_max_random_winners || 50
      
      if winners_count < 1
        @winners_count = 1
      elsif winners_count > max_winners
        raise ValidationError.new("获奖人数不能超过#{max_winners}人")
      else
        @winners_count = winners_count
      end
    end
  end

  def create_lottery_record!
    Rails.logger.debug "🎲 LotteryCreator: Creating lottery record"
    
    # 构建基础属性
    lottery_attributes = build_lottery_attributes
    
    # 创建记录
    lottery = Lottery.create!(lottery_attributes)
    
    Rails.logger.info "🎲 LotteryCreator: Created lottery record with ID #{lottery.id}"
    lottery
  end

  def build_lottery_attributes
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
    
    # 安全地添加可选字段
    if Lottery.column_names.include?('additional_notes') && data[:additional_notes].present?
      base_attributes[:additional_notes] = data[:additional_notes].strip
    end
    
    if Lottery.column_names.include?('prize_image') && data[:prize_image].present?
      base_attributes[:prize_image] = data[:prize_image].strip
    end
    
    base_attributes
  end

  def update_lottery_record!(lottery)
    Rails.logger.debug "🎲 LotteryCreator: Updating lottery record"
    
    update_attributes = build_lottery_attributes.except(:topic_id, :post_id, :user_id, :status)
    lottery.update!(update_attributes)
    
    Rails.logger.info "🎲 LotteryCreator: Updated lottery record #{lottery.id}"
  end

  def update_topic_metadata!(lottery)
    Rails.logger.debug "🎲 LotteryCreator: Updating topic metadata"
    
    begin
      # 构建展示数据
      display_data = build_display_data(lottery)
      
      # 更新topic的custom_fields
      topic.custom_fields['lottery_data'] = display_data.to_json
      topic.save_custom_fields
      
      # 更新post的custom_fields
      post.custom_fields['lottery_data'] = display_data.to_json
      post.save_custom_fields
      
      # 添加标签
      add_lottery_tag!
      
      Rails.logger.info "🎲 LotteryCreator: Updated topic metadata successfully"
      
    rescue => e
      Rails.logger.error "🎲 LotteryCreator: Failed to update metadata: #{e.message}"
      # 不中断主流程，但记录错误
    end
  end

  def build_display_data(lottery)
    data = {
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
      created_at: lottery.created_at.iso8601
    }
    
    # 安全地添加可选字段
    if lottery.respond_to?(:additional_notes) && lottery.additional_notes.present?
      data[:additional_notes] = lottery.additional_notes
    end
    
    if lottery.respond_to?(:prize_image) && lottery.prize_image.present?
      data[:prize_image] = lottery.prize_image
    end
    
    data
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
      
      Rails.logger.debug "🎲 LotteryCreator: Added lottery tag"
    rescue => e
      Rails.logger.warn "🎲 LotteryCreator: Failed to add tag: #{e.message}"
      # 标签添加失败不应中断主流程
    end
  end

  def schedule_background_tasks!(lottery)
    Rails.logger.debug "🎲 LotteryCreator: Scheduling background tasks"
    
    begin
      # 调度开奖任务
      Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
      
      # 调度锁定任务（如果需要）
      lock_delay = SiteSetting.lottery_post_lock_delay_minutes
      if lock_delay > 0
        lock_time = lottery.created_at + lock_delay.minutes
        Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
      end
      
      Rails.logger.info "🎲 LotteryCreator: Scheduled background tasks successfully"
    rescue => e
      Rails.logger.error "🎲 LotteryCreator: Failed to schedule tasks: #{e.message}"
      # 调度失败应该抛出异常，因为这是关键功能
      raise e
    end
  end

  def reschedule_background_tasks!(lottery)
    Rails.logger.debug "🎲 LotteryCreator: Rescheduling background tasks"
    
    begin
      # 取消现有任务（如果可能）
      # 注意：Sidekiq默认不支持取消已调度的任务，这里只是记录
      Rails.logger.info "🎲 Note: Existing scheduled tasks for lottery #{lottery.id} may still execute"
      
      # 重新调度
      schedule_background_tasks!(lottery)
      
    rescue => e
      Rails.logger.error "🎲 LotteryCreator: Failed to reschedule tasks: #{e.message}"
      raise e
    end
  end

  def create_error_post(error_message)
    begin
      PostCreator.create!(
        Discourse.system_user,
        topic_id: topic.id,
        raw: "🚫 **抽奖创建失败**\n\n#{error_message}\n\n请检查抽奖信息并重新创建。如需帮助，请联系管理员。"
      )
    rescue => e
      Rails.logger.error "🎲 LotteryCreator: Failed to create error post: #{e.message}"
      # 错误帖子创建失败不应影响主流程
    end
  end
end
