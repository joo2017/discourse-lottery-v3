# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册资源文件
register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"

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
end# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册资源文件
register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"

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
end
