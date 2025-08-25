# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册资源文件
register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"  # 新增
register_asset "javascripts/discourse/initializers/lottery-preview.js"

# 注册图标
register_svg_icon "dice"

after_initialize do
  Rails.logger.info "LotteryPlugin: Starting initialization"
  
  # 加载模型和服务
  begin
    require_relative 'lib/lottery'
    Rails.logger.info "LotteryPlugin: Loaded lottery model"
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to load lottery model: #{e.message}"
  end
  
  begin
    require_relative 'lib/lottery_creator'
    Rails.logger.info "LotteryPlugin: Loaded lottery creator"
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to load lottery creator: #{e.message}"
  end
  
  # 定义模型关联
  if defined?(Topic)
    Topic.class_eval do
      has_many :lotteries, dependent: :destroy
    end
    Rails.logger.info "LotteryPlugin: Added lotteries association to Topic"
  else
    Rails.logger.error "LotteryPlugin: Topic class not found"
  end
  
  # 监听话题创建事件
  DiscourseEvent.on(:post_created) do |post, opts, user|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1  # 只处理主楼层
    
    topic = post.topic
    Rails.logger.info "LotteryPlugin: Post created for topic #{topic.id}, checking for lottery data"
    
    # 检查是否有抽奖数据在 custom_fields 中
    lottery_data = topic.custom_fields['lottery']
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Found lottery data in custom_fields: #{lottery_data}"
      begin
        parsed_data = JSON.parse(lottery_data)
        Rails.logger.info "LotteryPlugin: Parsed data: #{parsed_data.inspect}"
        
        # 延迟执行，确保话题创建完成
        Jobs.enqueue_in(5.seconds, :create_lottery, {
          topic_id: topic.id,
          lottery_data: parsed_data,
          user_id: user.id
        })
        
        Rails.logger.info "LotteryPlugin: Enqueued lottery creation job"
      rescue => e
        Rails.logger.error "LotteryPlugin: Failed to parse lottery data: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.join("\n")}"
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery data found in custom_fields for topic #{topic.id}"
    end
  end

  # 监听帖子渲染，替换抽奖占位符为美化组件
  DiscourseEvent.on(:post_process_cooked) do |doc, post|
    next unless SiteSetting.lottery_enabled
    
    lottery_blocks = doc.css('p').select { |p| p.text.include?('[lottery]') }
    
    lottery_blocks.each do |block|
      content = block.text
      if content.match(/\[lottery\](.*?)\[\/lottery\]/m)
        # 解析抽奖数据
        lottery_info = $1
        lottery_data = parse_lottery_content(lottery_info)
        
        # 如果有对应的数据库记录，获取状态信息
        if post.topic&.lotteries&.first
          lottery_record = post.topic.lotteries.first
          lottery_data[:status] = lottery_record.status
        end
        
        # 替换为美化的HTML
        beautiful_html = generate_lottery_display_html(lottery_data)
        block.replace(beautiful_html)
        
        Rails.logger.info "LotteryPlugin: Replaced lottery placeholder with beautiful display"
      end
    end
  end
  
  Rails.logger.info "LotteryPlugin: Initialization completed"
  
  # 定义后台任务
  module ::Jobs
    class CreateLottery < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        lottery_data = args[:lottery_data]
        user_id = args[:user_id]
        
        Rails.logger.info "CreateLottery Job: Starting for topic #{topic_id}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          LotteryCreator.new(topic, lottery_data, user).create
          Rails.logger.info "CreateLottery Job: Successfully created lottery for topic #{topic_id}"
        rescue => e
          Rails.logger.error "CreateLottery Job: Failed to create lottery: #{e.message}"
          Rails.logger.error "CreateLottery Job: Backtrace: #{e.backtrace.join("\n")}"
          
          # 发布错误消息
          PostCreator.create!(
            Discourse.system_user,
            topic_id: topic_id,
            raw: "抽奖创建失败：#{e.message}。请联系管理员。"
          )
        end
      end
    end
  end

  # 解析抽奖内容的辅助方法
  def self.parse_lottery_content(content)
    data = {}
    content.split("\n").each do |line|
      line = line.strip
      next if line.empty?
      
      if line.include?('：')
        key, value = line.split('：', 2)
        case key.strip
        when '活动名称'
          data[:prize_name] = value.strip
        when '奖品说明'
          data[:prize_details] = value.strip
        when '开奖时间'
          data[:draw_time] = value.strip
        when '抽奖方式'
          data[:lottery_type] = value.strip
        when '获奖人数'
          data[:winners_count] = value.strip.to_i
        when '指定楼层'
          data[:specified_posts] = value.strip
        when '参与门槛'
          data[:min_participants] = value.gsub(/[^\d]/, '').to_i
        when '补充说明'
          data[:additional_notes] = value.strip
        when '奖品图片'
          data[:prize_image] = value.strip
        end
      end
    end
    data
  end

  # 生成美化显示HTML的方法
  def self.generate_lottery_display_html(data)
    status_class = "lottery-status-#{data[:status] || 'running'}"
    status_text = case data[:status]
                  when 'finished' then '🎉 已开奖'
                  when 'cancelled' then '❌ 已取消'
                  else '🏃 进行中'
                  end

    # 格式化开奖时间
    formatted_time = begin
      Time.parse(data[:draw_time]).strftime('%Y年%m月%d日 %H:%M')
    rescue
      data[:draw_time]
    end

    # 判断抽奖方式
    lottery_method = if data[:specified_posts] && !data[:specified_posts].empty?
                      "指定楼层 (#{data[:specified_posts]})"
                    else
                      "随机抽取 #{data[:winners_count]} 人"
                    end

    html = <<~HTML
      <div class="lottery-display-card #{status_class}">
        <div class="lottery-header">
          <div class="lottery-title">
            <span class="lottery-icon">🎲</span>
            <h3>#{data[:prize_name]}</h3>
          </div>
          <div class="lottery-status">#{status_text}</div>
        </div>
        <div class="lottery-content">
    HTML

    # 添加图片（如果有）
    if data[:prize_image] && !data[:prize_image].empty?
      html += <<~HTML
        <div class="lottery-image">
          <img src="#{data[:prize_image]}" alt="奖品图片" />
        </div>
      HTML
    end

    html += <<~HTML
          <div class="lottery-details">
            <div class="lottery-detail-item">
              <span class="label">🎁 奖品说明：</span>
              <span class="value">#{data[:prize_details]}</span>
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
              <span class="value">至少 #{data[:min_participants]} 人参与</span>
            </div>
    HTML

    # 添加补充说明（如果有）
    if data[:additional_notes] && !data[:additional_notes].empty?
      html += <<~HTML
            <div class="lottery-detail-item">
              <span class="label">📝 补充说明：</span>
              <span class="value">#{data[:additional_notes]}</span>
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
