# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
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
  
  # 监听话题创建事件 - 添加更多调试信息
  DiscourseEvent.on(:post_created) do |post, opts, user|
    Rails.logger.info "LotteryPlugin: Post created event fired"
    Rails.logger.info "LotteryPlugin: Post ID: #{post.id}, Post number: #{post.post_number}"
    Rails.logger.info "LotteryPlugin: Topic ID: #{post.topic.id}"
    Rails.logger.info "LotteryPlugin: User ID: #{user.id}"
    Rails.logger.info "LotteryPlugin: Lottery enabled: #{SiteSetting.lottery_enabled}"
    
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1  # 只处理主楼层
    
    topic = post.topic
    Rails.logger.info "LotteryPlugin: Processing main post for topic #{topic.id}"
    Rails.logger.info "LotteryPlugin: Topic custom_fields: #{topic.custom_fields.inspect}"
    
    # 检查是否有抽奖数据在 custom_fields 中
    lottery_data = topic.custom_fields['lottery']
    Rails.logger.info "LotteryPlugin: Lottery data found: #{lottery_data.present?}"
    
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Raw lottery data: #{lottery_data}"
      begin
        parsed_data = JSON.parse(lottery_data)
        Rails.logger.info "LotteryPlugin: Parsed data keys: #{parsed_data.keys}"
        Rails.logger.info "LotteryPlugin: Parsed data: #{parsed_data.inspect}"
        
        # 立即执行而不是延迟，避免时机问题
        Rails.logger.info "LotteryPlugin: Creating lottery immediately"
        LotteryCreator.new(topic, parsed_data, user).create
        Rails.logger.info "LotteryPlugin: Lottery created successfully"
        
      rescue => e
        Rails.logger.error "LotteryPlugin: Failed to create lottery: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.join("\n")}"
        
        # 发布错误消息
        PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: "抽奖创建失败：#{e.message}。请联系管理员。"
        )
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery data found in custom_fields"
      # 调试：检查是否有其他相关字段
      Rails.logger.info "LotteryPlugin: All custom_fields keys: #{topic.custom_fields.keys}"
    end
  end
  
  # 额外调试：监听话题保存事件
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    Rails.logger.info "LotteryPlugin: Topic created event fired for topic #{topic.id}"
    Rails.logger.info "LotteryPlugin: Topic custom_fields at creation: #{topic.custom_fields.inspect}"
  end
  
  Rails.logger.info "LotteryPlugin: Initialization completed"
end
