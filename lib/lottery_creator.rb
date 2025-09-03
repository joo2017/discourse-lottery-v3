# lib/lottery_creator.rb - 修复版本
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
  end

  def validate_data!
    Rails.logger.debug "LotteryCreator: Validating data"
    
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

    if draw_time > 1.year.from_now
      raise "开奖时间不能超过一年"
    end
  end

  def parse_draw_time
    @parsed_draw_time ||= begin
      time_str = data[:draw_time].to_s.strip
      
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
      topic.save_custom_fields
      
      post.custom_fields['lottery_data'] = lottery_display_data.to_json
      post.save_custom_fields
      
      Rails.logger.info "LotteryCreator: Updated custom fields successfully"
      
    rescue => e
      Rails.logger.error "LotteryCreator: Failed to update custom fields: #{e.message}"
    end
  end
end
