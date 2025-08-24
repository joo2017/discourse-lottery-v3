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
  
  # 官方推荐：注册 custom_field 类型
  Topic.register_custom_field_type('lottery_data', :json)
  
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
  end
  
  # 官方推荐：监听 post_created 事件，从 custom_fields 获取数据
  DiscourseEvent.on(:post_created) do |post, opts, user|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1  # 只处理主楼层
    
    topic = post.topic
    Rails.logger.info "LotteryPlugin: Post created for topic #{topic.id}"
    Rails.logger.info "LotteryPlugin: Checking for lottery in custom_fields"
    
    # 检查 topic.custom_fields 中的 lottery 数据
    if topic.custom_fields && topic.custom_fields['lottery_data']
      Rails.logger.info "LotteryPlugin: ✅ Found lottery_data in topic custom_fields"
      
      lottery_data = topic.custom_fields['lottery_data']
      Rails.logger.info "LotteryPlugin: Lottery data: #{lottery_data.inspect}"
      
      begin
        # 验证数据完整性
        if lottery_data['prize_name'].present? && lottery_data['prize_details'].present?
          Rails.logger.info "LotteryPlugin: ✅ Valid lottery data, creating lottery"
          
          # 创建抽奖记录
          Jobs.enqueue_in(2.seconds, :create_lottery, {
            topic_id: topic.id,
            lottery_data: lottery_data,
            user_id: user.id
          })
          
          Rails.logger.info "LotteryPlugin: ✅ Enqueued lottery creation job"
        else
          Rails.logger.warn "LotteryPlugin: ❌ Invalid lottery data - missing required fields"
        end
        
      rescue => e
        Rails.logger.error "LotteryPlugin: ❌ Error processing lottery data: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.join("\n")}"
      end
      
    else
      Rails.logger.info "LotteryPlugin: No lottery data found in custom_fields"
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
        Rails.logger.info "CreateLottery Job: Data: #{lottery_data.inspect}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          # 转换数据格式（适配 LotteryCreator）
          creator_data = {
            'prize_name' => lottery_data['prize_name'],
            'prize_details' => lottery_data['prize_details'],
            'draw_time' => lottery_data['draw_time'],
            'winners_count' => lottery_data['winners_count'],
            'min_participants' => lottery_data['min_participants'],
            'backup_strategy' => lottery_data['backup_strategy'],
            'additional_notes' => lottery_data['additional_notes'],
            'specified_posts' => lottery_data['specified_posts']
          }
          
          LotteryCreator.new(topic, creator_data, user).create
          Rails.logger.info "CreateLottery Job: ✅ Successfully created lottery"
          
        rescue => e
          Rails.logger.error "CreateLottery Job: ❌ Failed: #{e.message}"
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
