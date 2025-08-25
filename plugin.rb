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
  
  # 官方推荐：添加到 serializer
  add_to_serializer(:topic_view, :custom_fields) { object.topic.custom_fields }
  
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
  
  # 官方推荐：使用 :topic_created 事件处理 custom_fields
  on(:topic_created) do |topic, opts, user|
    Rails.logger.info "LotteryPlugin: Topic created event - ID: #{topic.id}"
    Rails.logger.info "LotteryPlugin: Opts keys: #{opts.keys}"
    
    # 检查是否有 custom_fields 参数中的 lottery 数据
    if opts[:custom_fields] && opts[:custom_fields]['lottery']
      Rails.logger.info "LotteryPlugin: ✅ Found lottery in custom_fields"
      
      lottery_data = opts[:custom_fields]['lottery']
      Rails.logger.info "LotteryPlugin: Lottery data: #{lottery_data.inspect}"
      
      # 设置 topic custom_fields
      topic.custom_fields['has_lottery'] = true
      topic.custom_fields['lottery_name'] = lottery_data['prize_name']
      topic.custom_fields['lottery_details'] = lottery_data['prize_details']
      topic.custom_fields['lottery_time'] = lottery_data['draw_time']
      topic.custom_fields['lottery_winners'] = lottery_data['winners_count']
      topic.custom_fields['lottery_min'] = lottery_data['min_participants']
      topic.custom_fields['lottery_strategy'] = lottery_data['backup_strategy']
      topic.custom_fields['lottery_notes'] = lottery_data['additional_notes'] || ""
      topic.custom_fields['lottery_posts'] = lottery_data['specified_posts'] || ""
      
      # 保存 custom_fields
      topic.save!
      Rails.logger.info "LotteryPlugin: ✅ Saved custom_fields to topic"
      Rails.logger.info "LotteryPlugin: Topic custom_fields: #{topic.custom_fields.inspect}"
      
      # 创建抽奖记录
      begin
        Jobs.enqueue_in(2.seconds, :create_lottery, {
          topic_id: topic.id,
          lottery_data: lottery_data,
          user_id: user.id
        })
        Rails.logger.info "LotteryPlugin: ✅ Enqueued lottery creation job"
      rescue => e
        Rails.logger.error "LotteryPlugin: ❌ Failed to enqueue job: #{e.message}"
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery data in custom_fields"
      Rails.logger.info "LotteryPlugin: Available opts: #{opts.inspect}"
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
