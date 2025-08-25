# name: discourse-lottery-v3
# about: A comprehensive lottery plugin following official Discourse best practices
# version: 1.0.0  
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册资源文件
register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"

# 注册图标
register_svg_icon "dice"

after_initialize do
  Rails.logger.info "LotteryPlugin: Initializing with official Discourse methods"
  
  # === 步骤1：注册自定义字段类型（官方推荐方法） ===
  register_topic_custom_field_type('lottery_data', :json)
  register_topic_custom_field_type('lottery_status', :string)
  register_topic_custom_field_type('lottery_created_at', :string)
  register_topic_custom_field_type('lottery_creator_id', :integer)
  
  Rails.logger.info "LotteryPlugin: Registered custom field types"
  
  # === 步骤2：添加getter/setter方法到Topic模型（官方推荐） ===
  add_to_class(:topic, :lottery_data) do
    if custom_fields['lottery_data'].present?
      begin
        JSON.parse(custom_fields['lottery_data'])
      rescue JSON::ParserError => e
        Rails.logger.error "LotteryPlugin: Failed to parse lottery_data: #{e.message}"
        nil
      end
    else
      nil
    end
  end
  
  add_to_class(:topic, :lottery_data=) do |value|
    if value.nil?
      custom_fields['lottery_data'] = nil
    else
      custom_fields['lottery_data'] = value.is_a?(String) ? value : value.to_json
    end
  end
  
  add_to_class(:topic, :lottery_status) do
    custom_fields['lottery_status'] || 'none'
  end
  
  add_to_class(:topic, :lottery_status=) do |value|
    custom_fields['lottery_status'] = value
  end
  
  add_to_class(:topic, :lottery_creator_id) do
    custom_fields['lottery_creator_id']&.to_i
  end
  
  add_to_class(:topic, :lottery_creator_id=) do |value|
    custom_fields['lottery_creator_id'] = value
  end
  
  add_to_class(:topic, :lottery_created_at) do
    custom_fields['lottery_created_at']
  end
  
  add_to_class(:topic, :lottery_created_at=) do |value|
    custom_fields['lottery_created_at'] = value
  end
  
  # 添加便捷方法
  add_to_class(:topic, :has_lottery?) do
    lottery_data.present? && lottery_status != 'none'
  end
  
  add_to_class(:topic, :lottery_active?) do
    lottery_status == 'running'
  end
  
  Rails.logger.info "LotteryPlugin: Added Topic model methods"
  
  # === 步骤3：预加载自定义字段（官方推荐 - 性能优化） ===
  add_preloaded_topic_list_custom_field('lottery_data')
  add_preloaded_topic_list_custom_field('lottery_status')
  add_preloaded_topic_list_custom_field('lottery_creator_id')
  add_preloaded_topic_list_custom_field('lottery_created_at')
  
  Rails.logger.info "LotteryPlugin: Added preloaded custom fields"
  
  # === 步骤4：序列化自定义字段到前端（官方推荐） ===
  
  # 4.1 序列化到topic_view（主题详情页）
  add_to_serializer(:topic_view, :lottery_data) do
    object.topic.lottery_data
  end
  
  add_to_serializer(:topic_view, :lottery_status) do
    object.topic.lottery_status
  end
  
  add_to_serializer(:topic_view, :lottery_creator_id) do
    object.topic.lottery_creator_id
  end
  
  add_to_serializer(:topic_view, :lottery_created_at) do
    object.topic.lottery_created_at
  end
  
  add_to_serializer(:topic_view, :has_lottery) do
    object.topic.has_lottery?
  end
  
  # 4.2 序列化到topic_list_item（主题列表）
  add_to_serializer(:topic_list_item, :lottery_data) do
    object.lottery_data
  end
  
  add_to_serializer(:topic_list_item, :lottery_status) do
    object.lottery_status
  end
  
  add_to_serializer(:topic_list_item, :has_lottery) do
    object.has_lottery?
  end
  
  # 4.3 序列化到basic_topic（基础主题信息）
  add_to_serializer(:basic_topic, :lottery_data) do
    object.lottery_data
  end
  
  add_to_serializer(:basic_topic, :lottery_status) do
    object.lottery_status
  end
  
  add_to_serializer(:basic_topic, :has_lottery) do
    object.has_lottery?
  end
  
  Rails.logger.info "LotteryPlugin: Added serializers"
  
  # === 步骤5：PostRevisor集成（支持编辑 - 官方推荐） ===
  PostRevisor.track_topic_field(:lottery_data) do |tc, value|
    tc.record_change('lottery_data', tc.topic.lottery_data, value)
    tc.topic.lottery_data = value
  end
  
  PostRevisor.track_topic_field(:lottery_status) do |tc, value|
    tc.record_change('lottery_status', tc.topic.lottery_status, value)
    tc.topic.lottery_status = value
  end
  
  Rails.logger.info "LotteryPlugin: Added PostRevisor tracking"
  
  # === 步骤6：监听主题创建事件（官方推荐方法） ===
  on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created #{topic.id}, checking for lottery data"
    
    # 检查多种可能的数据来源
    lottery_data = opts[:lottery_data] || 
                   opts['lottery_data'] ||
                   (opts[:custom_fields] && opts[:custom_fields]['lottery_data']) ||
                   (opts['custom_fields'] && opts['custom_fields']['lottery_data'])
    
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Found lottery data in topic creation"
      
      begin
        # 确保数据是Hash格式
        parsed_data = if lottery_data.is_a?(String)
                        JSON.parse(lottery_data)
                      else
                        lottery_data
                      end
        
        Rails.logger.info "LotteryPlugin: Parsed lottery data: #{parsed_data.inspect}"
        
        # 验证必填字段
        required_fields = %w[prize_name prize_details draw_time min_participants]
        missing_fields = required_fields.select { |field| parsed_data[field].blank? }
        
        if missing_fields.empty?
          Rails.logger.info "LotteryPlugin: Validation passed, saving lottery data"
          
          # 使用官方推荐的方式设置自定义字段
          topic.lottery_data = parsed_data
          topic.lottery_status = 'running'
          topic.lottery_creator_id = user.id
          topic.lottery_created_at = Time.current.iso8601
          
          # 保存自定义字段到数据库（官方推荐方法）
          topic.save_custom_fields(true)
          
          Rails.logger.info "LotteryPlugin: Successfully saved lottery data for topic #{topic.id}"
          
          # 延迟处理后续逻辑（标签、系统帖子等）
          Jobs.enqueue_in(1.second, :process_lottery_creation, {
            topic_id: topic.id,
            lottery_data: parsed_data,
            user_id: user.id
          })
          
        else
          Rails.logger.error "LotteryPlugin: Missing required fields: #{missing_fields.join(', ')}"
          create_error_post(topic, "抽奖创建失败：缺少必填字段 #{missing_fields.join(', ')}")
        end
        
      rescue JSON::ParserError => e
        Rails.logger.error "LotteryPlugin: JSON parse error: #{e.message}"
        create_error_post(topic, "抽奖数据格式错误：#{e.message}")
        
      rescue => e
        Rails.logger.error "LotteryPlugin: Unexpected error: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.first(3).join('\n')}"
        create_error_post(topic, "抽奖创建时发生错误：#{e.message}")
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery data found for topic #{topic.id}"
    end
  end
  
  # === 步骤7：后台任务处理（官方推荐的异步处理） ===
  module ::Jobs
    class ProcessLotteryCreation < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        lottery_data = args[:lottery_data]
        user_id = args[:user_id]
        
        Rails.logger.info "ProcessLotteryCreation: Processing topic #{topic_id}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          # 添加抽奖标签
          add_lottery_tag(topic)
          
          # 创建系统信息帖子
          create_lottery_info_post(topic, lottery_data)
          
          # 发布消息总线通知（实时更新前端）
          publish_lottery_notification(topic, lottery_data)
          
          Rails.logger.info "ProcessLotteryCreation: Successfully processed topic #{topic_id}"
          
        rescue ActiveRecord::RecordNotFound => e
          Rails.logger.error "ProcessLotteryCreation: Record not found: #{e.message}"
        rescue => e
          Rails.logger.error "ProcessLotteryCreation: Error: #{e.message}"
          Rails.logger.error "ProcessLotteryCreation: Backtrace: #{e.backtrace.first(3).join('\n')}"
        end
      end
      
      private
      
      def add_lottery_tag(topic)
        return unless SiteSetting.tagging_enabled
        
        lottery_tag = Tag.find_or_create_by(name: '抽奖中') do |tag|
          tag.description = '系统自动添加的抽奖活动标签'
        end
        
        unless topic.tags.include?(lottery_tag)
          DiscourseTagging.tag_topic_by_names(topic, Guardian.new(Discourse.system_user), [lottery_tag.name])
          Rails.logger.info "ProcessLotteryCreation: Added lottery tag to topic #{topic.id}"
        end
      rescue => e
        Rails.logger.warn "ProcessLotteryCreation: Failed to add tag: #{e.message}"
      end
      
      def create_lottery_info_post(topic, lottery_data)
        info_text = build_lottery_info_text(lottery_data)
        
        post = PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: info_text,
          skip_validations: true
        )
        
        Rails.logger.info "ProcessLotteryCreation: Created info post #{post.id}"
        post
      end
      
      def build_lottery_info_text(data)
        # 智能判断抽奖方式
        if data['specified_posts'].present?
          lottery_method = "指定楼层抽奖"
          winners_info = "**指定楼层：** #{data['specified_posts']}"
        else
          lottery_method = "随机抽奖"
          winners_count = data['winners_count'] || 1
          winners_info = "**获奖人数：** #{winners_count} 人"
        end
        
        # 格式化时间
        draw_time = begin
          DateTime.parse(data['draw_time']).strftime('%Y年%m月%d日 %H:%M')
        rescue
          data['draw_time']
        end
        
        info = <<~TEXT
          ## 🎲 抽奖活动详情

          **🎁 活动名称：** #{data['prize_name']}
          
          **📋 奖品说明：** #{data['prize_details']}
          
          **⏰ 开奖时间：** #{draw_time}
          
          **🎯 抽奖方式：** #{lottery_method}
          #{winners_info}
          
          **👥 参与门槛：** #{data['min_participants']} 人
          
          **🔄 后备策略：** #{data['backup_strategy'] == 'continue' ? '人数不足时继续开奖' : '人数不足时取消活动'}

        TEXT
        
        # 添加补充信息
        if data['additional_notes'].present?
          info += "**📝 补充说明：** #{data['additional_notes']}\n\n"
        end
        
        if data['prize_image'].present?
          info += "**🖼️ 奖品图片：**\n\n![奖品图片](#{data['prize_image']})\n\n"
        end
        
        info += <<~TEXT
          ---

          ### 🎮 参与方式

          💬 在本话题下回复即可参与抽奖

          📊 **当前状态：** 🏃‍♂️ 进行中

          🏷️ **活动标签：** #抽奖中

          ---

          *系统将在开奖时间自动进行抽奖，请耐心等待！* 🎉
        TEXT
        
        info
      end
      
      def publish_lottery_notification(topic, lottery_data)
        MessageBus.publish("/topic/#{topic.id}", {
          type: 'lottery_created',
          topic_id: topic.id,
          lottery_data: lottery_data
        })
        
        Rails.logger.info "ProcessLotteryCreation: Published MessageBus notification"
      rescue => e
        Rails.logger.warn "ProcessLotteryCreation: Failed to publish notification: #{e.message}"
      end
    end
  end
  
  # === 辅助方法 ===
  def self.create_error_post(topic, message)
    PostCreator.create!(
      Discourse.system_user,
      topic_id: topic.id,
      raw: "❌ #{message}\n\n请重新编辑主题并设置正确的抽奖信息。",
      skip_validations: true
    )
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to create error post: #{e.message}"
  end
  
  Rails.logger.info "LotteryPlugin: Initialization completed successfully"
end
