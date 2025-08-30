# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1.6
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"

register_svg_icon "dice"

after_initialize do
  Rails.logger.info "LotteryPlugin: Starting initialization"

  # ===================================================================
  # 注册自定义字段类型和权限
  # ===================================================================
  
  Post.register_custom_field_type('lottery_data', :json)
  Topic.register_custom_field_type('lottery', :json)
  Topic.register_custom_field_type('lottery_display_data', :json)
  
  # 添加创建帖子时的自定义参数权限
  DiscoursePluginRegistry.serialized_current_user_fields << "lottery_enabled"
  
  # 允许客户端传递 lottery 参数
  add_permitted_post_create_param('lottery')
  add_permitted_topic_create_param('lottery')

  # ===================================================================
  # 扩展序列化器
  # ===================================================================
  
  add_to_serializer(:post, :lottery_data, include_condition: -> {
    object.post_number == 1 && object.topic&.lotteries&.exists?
  }) do
    lottery = object.topic.lotteries.first
    return nil unless lottery

    {
      id: lottery.id,
      prize_name: lottery.prize_name,
      prize_details: lottery.prize_details,
      draw_time: lottery.draw_time&.iso8601,
      winners_count: lottery.winners_count,
      min_participants: lottery.min_participants,
      backup_strategy: lottery.backup_strategy,
      lottery_type: lottery.lottery_type,
      specified_posts: lottery.specified_post_numbers,
      status: lottery.status,
      additional_notes: lottery.additional_notes,
      prize_image: lottery.prize_image
    }
  end
  
  add_to_serializer(:topic_view, :lottery_data, include_condition: -> {
    object.topic&.lotteries&.exists?
  }) do
    lottery = object.topic.lotteries.first
    return nil unless lottery

    {
      id: lottery.id,
      prize_name: lottery.prize_name,
      prize_details: lottery.prize_details,
      draw_time: lottery.draw_time&.iso8601,
      winners_count: lottery.winners_count,
      min_participants: lottery.min_participants,
      backup_strategy: lottery.backup_strategy,
      lottery_type: lottery.lottery_type,
      specified_posts: lottery.specified_post_numbers,
      status: lottery.status,
      additional_notes: lottery.additional_notes,
      prize_image: lottery.prize_image
    }
  end
  
  Rails.logger.info "LotteryPlugin: Serializers extended"
  
  # 加载模型和服务
  begin
    require_relative 'lib/lottery'
    require_relative 'lib/lottery_creator'
    require_relative 'lib/lottery_manager'
    Rails.logger.info "LotteryPlugin: Loaded models and services"
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to load models: #{e.message}"
    Rails.logger.error "LotteryPlugin: #{e.backtrace.join("\n")}"
  end
  
  # 定义模型关联
  Topic.class_eval do
    has_many :lotteries, dependent: :destroy
  end

  Post.class_eval do
    has_many :lotteries, dependent: :destroy
  end

  User.class_eval do
    has_many :lotteries, foreign_key: :user_id, dependent: :destroy
  end
  
  Rails.logger.info "LotteryPlugin: Model associations added"
  
  # ===================================================================
  # 修复后的事件监听器 - 解决竞态条件
  # ===================================================================
  
  # 监听话题创建事件 - 优先从 opts 获取数据
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "=== LOTTERY DEBUG START ==="
    Rails.logger.info "LotteryPlugin: Topic created #{topic.id}"
    Rails.logger.info "LotteryPlugin: Opts keys: #{opts.keys.inspect}"
    Rails.logger.info "LotteryPlugin: Plugin enabled: #{SiteSetting.lottery_enabled}"
    Rails.logger.info "=== LOTTERY DEBUG END ==="
    
    # 方法1：优先从 opts 获取抽奖数据（最可靠）
    lottery_data_json = opts['lottery'] || opts[:lottery] || opts['custom_fields']&.dig('lottery')
    
    if lottery_data_json.present?
      Rails.logger.info "LotteryPlugin: Found lottery data in opts: #{lottery_data_json}"
      
      # 立即处理抽奖数据
      Jobs.enqueue(:process_lottery_immediate, {
        topic_id: topic.id,
        lottery_data_json: lottery_data_json,
        user_id: user.id
      })
    else
      # 方法2：延迟检查 custom_fields（备用方案）
      Rails.logger.info "LotteryPlugin: No lottery data in opts, scheduling delayed check"
      
      Jobs.enqueue_in(2.seconds, :process_lottery_delayed, {
        topic_id: topic.id,
        user_id: user.id
      })
    end
  end

  # 监听帖子编辑事件
  DiscourseEvent.on(:post_edited) do |post, topic_changed|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1
    lottery = post.topic&.lotteries&.first
    next unless lottery&.running?
    
    Rails.logger.info "LotteryPlugin: Lottery post edited, checking for updates"
    
    lock_delay = SiteSetting.lottery_post_lock_delay_minutes.minutes
    if lottery.created_at + lock_delay > Time.current
      Rails.logger.info "LotteryPlugin: Post edit within regret period, updating lottery"
      
      Jobs.enqueue(:update_lottery_from_edit, {
        lottery_id: lottery.id,
        post_id: post.id
      })
    else
      Rails.logger.info "LotteryPlugin: Post edit after regret period, ignoring"
    end
  end
  
  Rails.logger.info "LotteryPlugin: Event handlers registered"
  
  # ===================================================================
  # 后台任务定义 - 修复版本
  # ===================================================================
  
  module ::Jobs
    # 立即处理抽奖任务（从 opts 获取数据）
    class ProcessLotteryImmediate < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        lottery_data_json = args[:lottery_data_json]
        user_id = args[:user_id]
        
        Rails.logger.info "ProcessLotteryImmediate Job: Starting for topic #{topic_id}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          # 解析 JSON 数据
          lottery_data = JSON.parse(lottery_data_json)
          Rails.logger.info "ProcessLotteryImmediate Job: Parsed data: #{lottery_data.inspect}"
          
          # 创建抽奖记录
          lottery = LotteryCreator.new(topic, lottery_data, user).create
          
          # 调度开奖任务
          Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
          Rails.logger.info "ProcessLotteryImmediate Job: Scheduled draw job for #{lottery.draw_time}"
          
          # 调度锁定任务
          lock_delay = SiteSetting.lottery_post_lock_delay_minutes
          if lock_delay > 0
            lock_time = lottery.created_at + lock_delay.minutes
            Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
            Rails.logger.info "ProcessLotteryImmediate Job: Scheduled lock job for #{lock_time}"
          end
          
          # 通知前端更新
          MessageBus.publish("/topic/#{topic.id}", {
            type: "lottery_created",
            lottery_id: lottery.id
          })
          
          Rails.logger.info "ProcessLotteryImmediate Job: Successfully created lottery #{lottery.id}"
          
        rescue JSON::ParserError => e
          Rails.logger.error "ProcessLotteryImmediate Job: JSON parse error: #{e.message}"
          post_error_message(topic_id, "抽奖数据格式错误，请重新创建抽奖")
        rescue => e
          Rails.logger.error "ProcessLotteryImmediate Job: Failed: #{e.message}"
          Rails.logger.error "ProcessLotteryImmediate Job: #{e.backtrace.join("\n")}"
          post_error_message(topic_id, e.message)
        end
      end

      private

      def post_error_message(topic_id, error_message)
        Jobs.enqueue(:post_lottery_error, {
          topic_id: topic_id,
          error_message: error_message
        })
      end
    end

    # 延迟处理抽奖任务（从 custom_fields 获取数据）
    class ProcessLotteryDelayed < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        user_id = args[:user_id]
        
        Rails.logger.info "ProcessLotteryDelayed Job: Starting for topic #{topic_id}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          # 强制重新加载 custom_fields
          topic.reload
          topic.refresh_custom_fields_from_db
          
          lottery_data_json = topic.custom_fields['lottery']
          
          if lottery_data_json.present?
            Rails.logger.info "ProcessLotteryDelayed Job: Found lottery data: #{lottery_data_json}"
            
            # 解析并处理数据
            lottery_data = JSON.parse(lottery_data_json)
            Rails.logger.info "ProcessLotteryDelayed Job: Parsed data: #{lottery_data.inspect}"
            
            # 创建抽奖记录
            lottery = LotteryCreator.new(topic, lottery_data, user).create
            
            # 调度任务
            Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
            
            lock_delay = SiteSetting.lottery_post_lock_delay_minutes
            if lock_delay > 0
              lock_time = lottery.created_at + lock_delay.minutes
              Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
            end
            
            # 通知前端
            MessageBus.publish("/topic/#{topic.id}", {
              type: "lottery_created",
              lottery_id: lottery.id
            })
            
            Rails.logger.info "ProcessLotteryDelayed Job: Successfully created lottery #{lottery.id}"
          else
            Rails.logger.warn "ProcessLotteryDelayed Job: No lottery data found in custom_fields for topic #{topic_id}"
          end
          
        rescue JSON::ParserError => e
          Rails.logger.error "ProcessLotteryDelayed Job: JSON parse error: #{e.message}"
          post_error_message(topic_id, "抽奖数据格式错误")
        rescue => e
          Rails.logger.error "ProcessLotteryDelayed Job: Failed: #{e.message}"
          Rails.logger.error "ProcessLotteryDelayed Job: #{e.backtrace.join("\n")}"
          post_error_message(topic_id, e.message)
        end
      end

      private

      def post_error_message(topic_id, error_message)
        Jobs.enqueue(:post_lottery_error, {
          topic_id: topic_id,
          error_message: error_message
        })
      end
    end

    # 原有的任务保持不变
    class PostLotteryError < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        error_message = args[:error_message]
        
        begin
          PostCreator.create!(
            Discourse.system_user,
            topic_id: topic_id,
            raw: "🚫 **抽奖创建失败**\n\n#{error_message}\n\n请检查抽奖信息并重新创建，或联系管理员获取帮助。"
          )
          Rails.logger.info "PostLotteryError Job: Posted error message to topic #{topic_id}"
        rescue => e
          Rails.logger.error "PostLotteryError Job: Failed to post error: #{e.message}"
        end
      end
    end

    class LockLotteryPost < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          post = lottery.post
          
          Rails.logger.info "LockLotteryPost Job: Attempting to lock post #{post.id} for lottery #{lottery_id}"
          
          post.update!(locked_by_id: Discourse.system_user.id)
          
          PostCreator.create!(
            Discourse.system_user,
            topic_id: lottery.topic_id,
            raw: "🔒 抽奖信息已锁定，不允许再次编辑。如需修改，请联系管理员。"
          )
          
          Rails.logger.info "LockLotteryPost Job: Successfully locked post for lottery #{lottery_id}"
          
        rescue ActiveRecord::RecordNotFound => e
          Rails.logger.error "LockLotteryPost Job: Record not found: #{e.message}"
        rescue => e
          Rails.logger.error "LockLotteryPost Job: Failed to lock post: #{e.message}"
        end
      end
    end

    class ExecuteLotteryDraw < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          Rails.logger.info "ExecuteLotteryDraw Job: Starting draw for lottery #{lottery_id}"
          
          manager = LotteryManager.new(lottery)
          result = manager.execute_draw
          
          MessageBus.publish("/topic/#{lottery.topic_id}", {
            type: "lottery_completed",
            lottery_id: lottery.id,
            status: lottery.status
          })
          
          Rails.logger.info "ExecuteLotteryDraw Job: Draw completed with result: #{result}"
        rescue => e
          Rails.logger.error "ExecuteLotteryDraw Job: Failed: #{e.message}"
          
          begin
            lottery = Lottery.find(lottery_id)
            lottery.update!(status: 'cancelled')
            
            PostCreator.create!(
              Discourse.system_user,
              topic_id: lottery.topic_id,
              raw: "❌ **开奖失败**\n\n系统在执行开奖时遇到错误：#{e.message}\n\n请联系管理员处理。"
            )
          rescue => inner_e
            Rails.logger.error "ExecuteLotteryDraw Job: Failed to handle error: #{inner_e.message}"
          end
        end
      end
    end

    class UpdateLotteryFromEdit < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        post_id = args[:post_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          post = Post.find(post_id)
          
          Rails.logger.info "UpdateLotteryFromEdit Job: Updating lottery #{lottery_id} from post edit"
          
          # 强制重新加载 custom_fields
          post.topic.reload
          post.topic.refresh_custom_fields_from_db
          
          new_lottery_data = post.topic.custom_fields['lottery']
          
          if new_lottery_data.present?
            begin
              parsed_data = JSON.parse(new_lottery_data)
              LotteryCreator.new(lottery.topic, parsed_data, lottery.user).update_existing(lottery)
              
              MessageBus.publish("/topic/#{lottery.topic_id}", {
                type: "lottery_updated",
                lottery_id: lottery.id
              })
              
              Rails.logger.info "UpdateLotteryFromEdit Job: Updated lottery successfully"
            rescue JSON::ParserError => e
              Rails.logger.error "UpdateLotteryFromEdit Job: Failed to parse lottery data: #{e.message}"
            end
          end
        rescue => e
          Rails.logger.error "UpdateLotteryFromEdit Job: Failed: #{e.message}"
        end
      end
    end
  end
  
  Rails.logger.info "LotteryPlugin: Job classes defined"
  Rails.logger.info "LotteryPlugin: Initialization completed successfully"
end
