# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on official best practices
# version: 0.1
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
  Rails.logger.info "LotteryPlugin: Starting initialization with official custom fields approach"
  
  # === 第一步：注册自定义字段类型（官方推荐） ===
  register_topic_custom_field_type('lottery_data', :json)
  register_topic_custom_field_type('lottery_status', :string)
  
  Rails.logger.info "LotteryPlugin: Registered custom field types"
  
  # === 第二步：为Topic模型添加getter/setter方法 ===
  add_to_class(:topic, :lottery_data) do
    if custom_fields['lottery_data'].present?
      begin
        JSON.parse(custom_fields['lottery_data'])
      rescue JSON::ParserError
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
  
  # 添加便捷方法
  add_to_class(:topic, :has_lottery?) do
    lottery_data.present?
  end
  
  Rails.logger.info "LotteryPlugin: Added getter/setter methods to Topic model"
  
  # === 第三步：序列化到前端（官方推荐） ===
  add_to_serializer(:topic_view, :lottery_data) do
    object.topic.lottery_data
  end
  
  add_to_serializer(:topic_view, :lottery_status) do
    object.topic.lottery_status
  end
  
  add_to_serializer(:topic_view, :has_lottery) do
    object.topic.has_lottery?
  end
  
  # 添加到BasicTopicSerializer（用于主题列表）
  add_to_serializer(:basic_topic, :lottery_data) do
    object.lottery_data if object.respond_to?(:lottery_data)
  end
  
  add_to_serializer(:basic_topic, :lottery_status) do
    object.lottery_status if object.respond_to?(:lottery_status)
  end
  
  add_to_serializer(:basic_topic, :has_lottery) do
    object.has_lottery? if object.respond_to?(:has_lottery?)
  end
  
  # 添加到ListableTopicSerializer（用于主题列表详细信息）
  add_to_serializer(:listable_topic, :lottery_data) do
    object.lottery_data if object.respond_to?(:lottery_data)
  end
  
  add_to_serializer(:listable_topic, :lottery_status) do
    object.lottery_status if object.respond_to?(:lottery_status)
  end
  
  add_to_serializer(:listable_topic, :has_lottery) do
    object.has_lottery? if object.respond_to?(:has_lottery?)
  end
  
  # 预加载到主题列表
  add_preloaded_topic_list_custom_field('lottery_data')
  add_preloaded_topic_list_custom_field('lottery_status')
  
  # 序列化到主题列表
  add_to_serializer(:topic_list_item, :lottery_data) do
    object.lottery_data
  end
  
  add_to_serializer(:topic_list_item, :lottery_status) do
    object.lottery_status
  end
  
  add_to_serializer(:topic_list_item, :has_lottery) do
    object.has_lottery?
  end
  
  # 增强PostSerializer（用于包含抽奖信息的帖子）
  add_to_serializer(:post, :topic_lottery_data) do
    object.topic.lottery_data if object.topic&.respond_to?(:lottery_data)
  end
  
  add_to_serializer(:post, :topic_lottery_status) do
    object.topic.lottery_status if object.topic&.respond_to?(:lottery_status)
  end
  
  Rails.logger.info "LotteryPlugin: Added serializers"
  
  # === 第四步：PostRevisor集成（支持编辑） ===
  PostRevisor.track_topic_field(:lottery_data) do |tc, value|
    tc.record_change('lottery_data', tc.topic.lottery_data, value)
    tc.topic.lottery_data = value
  end
  
  PostRevisor.track_topic_field(:lottery_status) do |tc, value|
    tc.record_change('lottery_status', tc.topic.lottery_status, value) 
    tc.topic.lottery_status = value
  end
  
  Rails.logger.info "LotteryPlugin: Added PostRevisor tracking"
  
  # === 第五步：数据验证方法 ===
  def self.validate_lottery_data(data)
    errors = []
    
    # 必填字段验证
    required_fields = {
      'prize_name' => '活动名称',
      'prize_details' => '奖品说明', 
      'draw_time' => '开奖时间',
      'min_participants' => '参与门槛'
    }
    
    required_fields.each do |field, label|
      if data[field].blank?
        errors << "#{label}不能为空"
      end
    end
    
    # 开奖时间验证
    if data['draw_time'].present?
      begin
        draw_time = DateTime.parse(data['draw_time'])
        if draw_time <= DateTime.current
          errors << "开奖时间必须是未来时间"
        end
        
        # 检查是否至少30分钟后
        min_time = DateTime.current + 30.minutes
        if draw_time < min_time
          errors << "开奖时间至少要在30分钟之后"
        end
      rescue ArgumentError
        errors << "开奖时间格式无效"
      end
    end
    
    # 参与门槛验证
    if data['min_participants'].present?
      min_participants = data['min_participants'].to_i
      global_min = SiteSetting.lottery_min_participants_global
      if min_participants < global_min
        errors << "参与门槛不能低于#{global_min}人"
      end
    end
    
    # 获奖人数验证
    if data['winners_count'].present?
      winners_count = data['winners_count'].to_i
      if winners_count <= 0
        errors << "获奖人数必须大于0"
      end
    end
    
    # URL验证（如果有图片）
    if data['prize_image'].present?
      begin
        uri = URI.parse(data['prize_image'])
        unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
          errors << "奖品图片URL格式无效"
        end
      rescue URI::InvalidURIError
        errors << "奖品图片URL格式无效"
      end
    end
    
    errors
  end
  
  # === 第六步：监听topic创建事件 ===
  on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created #{topic.id}"
    Rails.logger.info "LotteryPlugin: Available opts keys: #{opts.keys}"
    Rails.logger.info "LotteryPlugin: Opts content: #{opts.inspect}"
    
    # 多种方式检查抽奖数据
    lottery_data = opts[:lottery_data] || 
                   opts['lottery_data'] ||
                   (opts[:custom_fields] && opts[:custom_fields]['lottery_data'])
    
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Found lottery data: #{lottery_data}"
      
      begin
        # 确保数据是Hash格式
        parsed_data = lottery_data.is_a?(String) ? JSON.parse(lottery_data) : lottery_data
        Rails.logger.info "LotteryPlugin: Parsed lottery data: #{parsed_data.inspect}"
        
        # 数据验证
        validation_errors = validate_lottery_data(parsed_data)
        
        if validation_errors.empty?
          # 保存数据到topic
          topic.lottery_data = parsed_data
          topic.lottery_status = 'running'
          topic.save_custom_fields(true)
          
          Rails.logger.info "LotteryPlugin: Successfully saved lottery data for topic #{topic.id}"
          
          # 延迟执行后续处理
          Jobs.enqueue_in(2.seconds, :process_lottery_creation, {
            topic_id: topic.id,
            lottery_data: parsed_data,
            user_id: user.id
          })
          
        else
          Rails.logger.error "LotteryPlugin: Validation errors: #{validation_errors.join(', ')}"
          
          # 创建错误提示帖子
          PostCreator.create!(
            Discourse.system_user,
            topic_id: topic.id,
            raw: "❌ **抽奖创建失败**\n\n#{validation_errors.map { |e| "• #{e}" }.join("\n")}\n\n请编辑主题重新设置抽奖信息。"
          )
        end
        
      rescue JSON::ParserError => e
        Rails.logger.error "LotteryPlugin: JSON parse error: #{e.message}"
        
        PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: "❌ **抽奖数据格式错误**\n\n无法解析抽奖信息，请重新创建。"
        )
        
      rescue => e
        Rails.logger.error "LotteryPlugin: Unexpected error: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.first(5).join('\n')}"
        
        PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: "❌ **抽奖创建时发生未知错误**\n\n#{e.message}\n\n请联系管理员。"
        )
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery data found for topic #{topic.id}"
    end
  end
  
  # === 第七步：后台任务处理 ===
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
          create_lottery_info_post(topic, lottery_data, user)
          
          # 发布消息总线通知
          publish_lottery_created(topic, lottery_data)
          
          Rails.logger.info "ProcessLotteryCreation: Successfully processed topic #{topic_id}"
          
        rescue ActiveRecord::RecordNotFound => e
          Rails.logger.error "ProcessLotteryCreation: Record not found: #{e.message}"
        rescue => e
          Rails.logger.error "ProcessLotteryCreation: Error: #{e.message}"
          Rails.logger.error "ProcessLotteryCreation: Backtrace: #{e.backtrace.first(5).join('\n')}"
          
          # 尝试创建错误通知帖子
          begin
            PostCreator.create!(
              Discourse.system_user,
              topic_id: topic_id,
              raw: "❌ **抽奖处理失败**\n\n#{e.message}\n\n请联系管理员。"
            )
          rescue => inner_e
            Rails.logger.error "ProcessLotteryCreation: Failed to create error post: #{inner_e.message}"
          end
        end
      end
      
      private
      
      def add_lottery_tag(topic)
        lottery_tag = Tag.find_or_create_by(name: '抽奖中')
        unless topic.tags.include?(lottery_tag)
          topic.tags << lottery_tag
          Rails.logger.info "ProcessLotteryCreation: Added lottery tag to topic #{topic.id}"
        end
      rescue => e
        Rails.logger.warn "ProcessLotteryCreation: Failed to add tag: #{e.message}"
      end
      
      def create_lottery_info_post(topic, lottery_data, user)
        # 构建信息文本
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
          lottery_method = "指定楼层 (#{data['specified_posts']})"
          winners_info = "**指定楼层：** #{data['specified_posts']}"
        else
          lottery_method = "随机抽取"
          winners_count = data['winners_count'] || 1
          winners_info = "**获奖人数：** #{winners_count} 人"
        end
        
        # 格式化开奖时间
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
          
          **👥 参与门槛：** 至少需要 #{data['min_participants']} 人参与
          
          **🔄 后备策略：** #{data['backup_strategy'] == 'continue' ? '人数不足时继续开奖' : '人数不足时取消活动'}

        TEXT
        
        # 添加补充说明
        if data['additional_notes'].present?
          info += "**📝 补充说明：** #{data['additional_notes']}\n\n"
        end
        
        # 添加奖品图片
        if data['prize_image'].present?
          info += "**🖼️ 奖品图片：**\n\n![奖品图片](#{data['prize_image']})\n\n"
        end
        
        info += <<~TEXT
          ---

          ### 🎮 如何参与

          💬 **参与方式：** 在本话题下回复即可参与抽奖
          
          📊 **当前状态：** 🏃‍♂️ 进行中
          
          🏷️ **活动标签：** #抽奖中
          
          ---
          
          *系统将在开奖时间自动进行抽奖，请耐心等待！* 🎉
        TEXT
        
        info
      end
      
      def publish_lottery_created(topic, lottery_data)
        # 发布消息总线通知
        MessageBus.publish("/topic/#{topic.id}", {
          type: 'lottery_created',
          topic_id: topic.id,
          lottery_data: lottery_data
        })
        
        Rails.logger.info "ProcessLotteryCreation: Published message bus notification"
      rescue => e
        Rails.logger.warn "ProcessLotteryCreation: Failed to publish notification: #{e.message}"
      end
    end
  end
  
  # === 第八步：内容处理（美化显示） ===
  DiscourseEvent.on(:post_process_cooked) do |doc, post|
    next unless SiteSetting.lottery_enabled
    
    # 检查是否是抽奖主题
    if post.topic&.has_lottery?
      lottery_data = post.topic.lottery_data
      lottery_status = post.topic.lottery_status
      
      if lottery_data
        # 查找并替换抽奖占位符
        lottery_blocks = doc.css('p').select { |p| p.text.include?('[lottery]') }
        
        lottery_blocks.each do |block|
          content = block.text
          if content.match(/\[lottery\](.*?)\[\/lottery\]/m)
            # 生成美化的HTML
            beautiful_html = generate_lottery_display_html(lottery_data, lottery_status)
            block.replace(beautiful_html)
            
            Rails.logger.info "LotteryPlugin: Replaced lottery placeholder with beautiful display"
          end
        end
      end
    end
  end
  
  Rails.logger.info "LotteryPlugin: Initialization completed successfully"
  
  # === 辅助方法 ===
  def self.generate_lottery_display_html(data, status = 'running')
    status_class = "lottery-status-#{status}"
    status_text = case status
                  when 'finished' then '🎉 已开奖'
                  when 'cancelled' then '❌ 已取消'
                  else '🏃 进行中'
                  end

    # 格式化开奖时间
    formatted_time = begin
      DateTime.parse(data['draw_time']).strftime('%Y年%m月%d日 %H:%M')
    rescue
      data['draw_time']
    end

    # 判断抽奖方式
    lottery_method = if data['specified_posts']&.present?
                      "指定楼层 (#{data['specified_posts']})"
                    else
                      "随机抽取 #{data['winners_count'] || 1} 人"
                    end

    html = <<~HTML
      <div class="lottery-display-card #{status_class}">
        <div class="lottery-header">
          <div class="lottery-title">
            <span class="lottery-icon">🎲</span>
            <h3>#{data['prize_name']}</h3>
          </div>
          <div class="lottery-status">#{status_text}</div>
        </div>
        <div class="lottery-content">
    HTML

    # 添加图片（如果有）
    if data['prize_image']&.present?
      html += <<~HTML
        <div class="lottery-image">
          <img src="#{data['prize_image']}" alt="奖品图片" />
        </div>
      HTML
    end

    html += <<~HTML
          <div class="lottery-details">
            <div class="lottery-detail-item">
              <span class="label">🎁 奖品说明：</span>
              <span class="value">#{data['prize_details']}</span>
            </div>
            <div class="lottery-detail-item">
              <span class="label">⏰ 开奖时间：</span>
              <span class="value">#{formatted_time}</span>
            </div>
            <div class="lottery-detail-item">
              <span class="label">🎯 抽奖方式：</span>
              <span class="value">#{lottery_method}</span>
            </div>
            <div class="lottery-detail-item">
              <span class="label">👥 参与门槛：</span>
              <span class="value">至少 #{data['min_participants']} 人参与</span>
            </div>
    HTML

    # 添加补充说明（如果有）
    if data['additional_notes']&.present?
      html += <<~HTML
            <div class="lottery-detail-item">
              <span class="label">📝 补充说明：</span>
              <span class="value">#{data['additional_notes']}</span>
            </div>
      HTML
    end

    html += <<~HTML
          </div>
        </div>
        <div class="lottery-footer">
          <div class="participation-tip">
            💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖
          </div>
        </div>
      </div>
    HTML

    html
  end
end
