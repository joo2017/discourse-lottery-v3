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
  Topic.register_custom_field_type('has_lottery', :boolean)
  Topic.register_custom_field_type('lottery_name', :string)
  Topic.register_custom_field_type('lottery_details', :string)
  Topic.register_custom_field_type('lottery_time', :string)
  Topic.register_custom_field_type('lottery_winners', :integer)
  Topic.register_custom_field_type('lottery_min', :integer)
  Topic.register_custom_field_type('lottery_strategy', :string)
  Topic.register_custom_field_type('lottery_notes', :string)
  Topic.register_custom_field_type('lottery_posts', :string)
  
  Rails.logger.info "LotteryPlugin: Registered custom field types"
  
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
  
  # 官方推荐：添加到 serializer 以便客户端访问
  add_to_serializer(:topic_view, :custom_fields) do
    object.topic.custom_fields
  end
  
  # 监听话题创建事件
  DiscourseEvent.on(:post_created) do |post, opts, user|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1  # 只处理主楼层
    
    topic = post.topic
    Rails.logger.info "LotteryPlugin: Post created for topic #{topic.id}"
    Rails.logger.info "LotteryPlugin: Custom fields: #{topic.custom_fields.inspect}"
    
    # 检查是否是抽奖话题
    if topic.custom_fields['has_lottery']
      Rails.logger.info "LotteryPlugin: ✅ Found lottery topic"
      
      # 重建数据结构
      lottery_data = {
        'prize_name' => topic.custom_fields['lottery_name'],
        'prize_details' => topic.custom_fields['lottery_details'],
        'draw_time' => topic.custom_fields['lottery_time'],
        'winners_count' => topic.custom_fields['lottery_winners'].to_i,
        'min_participants' => topic.custom_fields['lottery_min'].to_i,
        'backup_strategy' => topic.custom_fields['lottery_strategy'],
        'additional_notes' => topic.custom_fields['lottery_notes'],
        'specified_posts' => topic.custom_fields['lottery_posts']
      }
      
      Rails.logger.info "LotteryPlugin: Reconstructed data: #{lottery_data.inspect}"
      
      # 验证必要字段
      if lottery_data['prize_name'].present? && lottery_data['prize_details'].present?
        Rails.logger.info "LotteryPlugin: ✅ Valid lottery data, creating lottery"
        
        Jobs.enqueue_in(5.seconds, :create_lottery, {
          topic_id: topic.id,
          lottery_data: lottery_data,
          user_id: user.id
        })
        
        Rails.logger.info "LotteryPlugin: ✅ Enqueued lottery creation job"
      else
        Rails.logger.warn "LotteryPlugin: ❌ Invalid lottery data, missing required fields"
      end
    else
      Rails.logger.info "LotteryPlugin: Not a lottery topic"
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
