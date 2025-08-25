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
  
  # === 第五步：监听topic创建事件 ===
  on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created #{topic.id}, checking for lottery data"
    Rails.logger.info "LotteryPlugin: Opts keys: #{opts.keys}"
    
    # 检查opts中的lottery_data
    if opts[:lottery_data].present?
      Rails.logger.info "LotteryPlugin: Found lottery_data in opts: #{opts[:lottery_data]}"
      
      begin
        # 解析数据
        lottery_data = opts[:lottery_data].is_a?(String) ? JSON.parse(opts[:lottery_data]) : opts[:lottery_data]
        
        # 验证必填字段
        required_fields = %w[prize_name prize_details draw_time min_participants]
        missing_fields = required_fields.select { |field| lottery_data[field].blank? }
        
        if missing_fields.empty?
          # 设置抽奖数据
          topic.lottery_data = lottery_data
          topic.lottery_status = 'running'
          topic.save_custom_fields(true)
          
          Rails.logger.info "LotteryPlugin: Successfully saved lottery data to topic #{topic.id}"
          
          # 延迟创建抽奖记录和系统帖子
          Jobs.enqueue_in(2.seconds, :create_lottery_system_post, {
            topic_id: topic.id,
            lottery_data: lottery_data,
            user_id: user.id
          })
          
        else
          Rails.logger.error "LotteryPlugin: Missing required fields: #{missing_fields.join(', ')}"
        end
        
      rescue JSON::ParserError => e
        Rails.logger.error "LotteryPlugin: Failed to parse lottery data: #{e.message}"
      rescue => e
        Rails.logger.error "LotteryPlugin: Error processing lottery data: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.first(5).join('\n')}"
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery_data found in opts"
    end
  end
  
  # === 第六步：后台任务处理 ===
  module ::Jobs
    class CreateLotterySystemPost < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        lottery_data = args[:lottery_data]
        user_id = args[:user_id]
        
        Rails.logger.info "CreateLotterySystemPost: Starting for topic #{topic_id}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          # 添加抽奖标签
          add_lottery_tag(topic)
          
          # 创建系统提示帖子
          create_system_post(topic, lottery_data)
          
          Rails.logger.info "CreateLotterySystemPost: Successfully processed topic #{topic_id}"
          
        rescue => e
          Rails.logger.error "CreateLotterySystemPost: Error: #{e.message}"
          Rails.logger.error "CreateLotterySystemPost: Backtrace: #{e.backtrace.first(5).join('\n')}"
        end
      end
      
      private
      
      def add_lottery_tag(topic)
        lottery_tag = Tag.find_or_create_by(name: '抽奖中')
        topic.tags << lottery_tag unless topic.tags.include?(lottery_tag)
        Rails.logger.info "CreateLotterySystemPost: Added lottery tag to topic #{topic.id}"
      rescue => e
        Rails.logger.warn "CreateLotterySystemPost: Failed to add tag: #{e.message}"
      end
      
      def create_system_post(topic, lottery_data)
        # 构建抽奖信息文本
        lottery_info = build_lottery_info(lottery_data)
        
        post = PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: lottery_info
        )
        
        Rails.logger.info "CreateLotterySystemPost: Created system post #{post.id}"
        post
      end
      
      def build_lottery_info(data)
        # 智能判断抽奖方式
        if data['specified_posts'].present?
          lottery_method = "指定楼层 (#{data['specified_posts']})"
          winners_info = "**获奖楼层：** #{data['specified_posts']}"
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
          ## 🎲 抽奖活动信息

          **活动名称：** #{data['prize_name']}
          **奖品说明：** #{data['prize_details']}
          **开奖时间：** #{draw_time}
          **抽奖方式：** #{lottery_method}
          #{winners_info}
          **参与门槛：** 至少需要 #{data['min_participants']} 人参与
          **后备策略：** #{data['backup_strategy'] == 'continue' ? '人数不足时继续开奖' : '人数不足时取消活动'}

        TEXT
        
        # 添加补充说明
        if data['additional_notes'].present?
          info += "**补充说明：** #{data['additional_notes']}\n\n"
        end
        
        # 添加图片
        if data['prize_image'].present?
          info += "**奖品图片：**\n![奖品图片](#{data['prize_image']})\n\n"
        end
        
        info += <<~TEXT
          ---

          💡 **参与方式：** 在本话题下回复即可参与抽奖

          🏷️ **活动状态：** 🏃 进行中
        TEXT
        
        info
      end
    end
  end
  
  # === 第七步：内容处理（美化显示） ===
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
