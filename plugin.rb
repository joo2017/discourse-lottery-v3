# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

after_initialize do
  Rails.logger.info "LotteryPlugin: Starting initialization"
  
  # 临时跳过 custom field 注册，直接处理字符串
  # register_topic_custom_field_type('lottery', :json)
  # Rails.logger.info "LotteryPlugin: Registered lottery custom field"
  
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
  
  # 定义模型关联 - 使用更可靠的方式
  if defined?(Topic)
    Topic.class_eval do
      has_many :lotteries, dependent: :destroy
    end
    Rails.logger.info "LotteryPlugin: Added lotteries association to Topic"
  else
    Rails.logger.error "LotteryPlugin: Topic class not found"
  end
  
  # 监听话题创建事件 - 使用 post_created 事件（更可靠）
  DiscourseEvent.on(:post_created) do |post, opts, user|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1  # 只处理主楼层
    
    topic = post.topic
    Rails.logger.info "LotteryPlugin: Post created for topic #{topic.id}, checking for lottery data"
    
    # 检查话题标题是否包含抽奖相关关键词（临时方案）
    if topic.title.include?('抽奖') || topic.title.include?('lottery')
      Rails.logger.info "LotteryPlugin: Detected lottery topic by title: #{topic.title}"
      
      # 创建测试数据（临时方案，用于测试后台功能）
      test_data = {
        'prize_name' => '测试抽奖活动',
        'prize_details' => '这是通过标题检测创建的测试抽奖',
        'draw_time' => (Time.current + 1.day).strftime('%Y-%m-%dT%H:%M'),
        'winners_count' => 1,
        'specified_posts' => '',
        'min_participants' => 10,  # 修改为 10，符合全局最小要求
        'backup_strategy' => 'continue',
        'additional_notes' => '通过标题关键词自动创建'
      }
      
      Rails.logger.info "LotteryPlugin: Using test data for lottery creation"
      
      # 延迟执行，确保话题创建完成
      Jobs.enqueue_in(5.seconds, :create_lottery, {
        topic_id: topic.id,
        lottery_data: test_data,
        user_id: user.id
      })
      
      Rails.logger.info "LotteryPlugin: Enqueued lottery creation job for test"
    else
      Rails.logger.info "LotteryPlugin: Topic title does not contain lottery keywords: #{topic.title}"
    end
  end
  
  Rails.logger.info "LotteryPlugin: Initialization completed"
  
  # 定义后台任务 - 移到 after_initialize 内
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
