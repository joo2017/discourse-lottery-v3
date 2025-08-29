# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1.0
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

  # ===================================================================
  # 扩展序列化器 (修正: 移动到 after_initialize 内部)
  # ===================================================================
  add_to_serializer(:topic_view, :lottery_data) do
    # 使用 object.topic 确保我们获取的是 Topic 模型
    lottery = object.topic.lotteries.first
    return nil unless lottery

    {
      id: lottery.id,
      prize_name: lottery.prize_name,
      prize_details: lottery.prize_details,
      draw_time: lottery.draw_time.iso8601,
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

  add_to_serializer(:topic_view, :include_lottery_data?) do
    object.topic.lotteries.exists?
  end

  add_to_serializer(:post, :lottery_data) do
    # 确保 post.topic 存在，并且只在首帖添加数据
    return nil unless post&.topic && post.post_number == 1 && post.topic.lotteries.exists?
    
    lottery = post.topic.lotteries.first
    {
      id: lottery.id,
      prize_name: lottery.prize_name,
      prize_details: lottery.prize_details,
      draw_time: lottery.draw_time.iso8601,
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

  add_to_serializer(:post, :include_lottery_data?) do
    post&.topic && post.post_number == 1 && post.topic.lotteries.exists?
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
  Rails.logger.info "LotteryPlugin: Added lotteries association to Topic"

  Post.class_eval do
    # 注意：一个抽奖应该只关联一个Post（首帖），但一个Post可以有多个lotteries吗？
    # 理论上一个主题只有一个抽奖，所以关联到Topic更合理。这里的关联可以保留，但业务逻辑要清晰。
    has_many :lotteries, dependent: :destroy
  end
  Rails.logger.info "LotteryPlugin: Added lotteries association to Post"

  User.class_eval do
    # 这里的关联表示一个用户可以发起多个抽奖
    has_many :lotteries, foreign_key: :user_id, dependent: :destroy
  end
  Rails.logger.info "LotteryPlugin: Added lotteries association to User"
  
  # 监听话题创建事件
  DiscourseEvent.on(:topic_created) do |topic, params, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created #{topic.id}, checking for lottery data"
    
    # 从 params 中获取 custom_fields，这比从 topic.custom_fields 更可靠，因为此时可能还未完全保存
    lottery_data_json = params[:custom_fields]&.[]('lottery')
    
    if lottery_data_json.present?
      Rails.logger.info "LotteryPlugin: Found lottery data: #{lottery_data_json}"
      
      begin
        lottery_data = JSON.parse(lottery_data_json)
        Rails.logger.info "LotteryPlugin: Parsed lottery data: #{lottery_data.inspect}"
        
        # 延迟处理，确保话题完全创建完成
        Jobs.enqueue_in(2.seconds, :create_lottery, {
          topic_id: topic.id,
          lottery_data: lottery_data,
          user_id: user.id
        })
        
        Rails.logger.info "LotteryPlugin: Enqueued lottery creation job for topic #{topic.id}"
      rescue JSON::ParserError => e
        Rails.logger.error "LotteryPlugin: Failed to parse lottery JSON: #{e.message}"
        
        # 在话题中发布错误信息
        Jobs.enqueue_in(5.seconds, :post_lottery_error, {
          topic_id: topic.id,
          error_message: "抽奖数据格式错误，请重新创建抽奖"
        })
      rescue => e
        Rails.logger.error "LotteryPlugin: Unexpected error processing lottery: #{e.message}"
        Rails.logger.error "LotteryPlugin: #{e.backtrace.join("\n")}"
      end
    else
      Rails.logger.debug "LotteryPlugin: No lottery data found for topic #{topic.id}"
    end
  end

  # 监听帖子编辑事件
  DiscourseEvent.on(:post_edited) do |post, topic_changed|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1
    lottery = post.topic&.lotteries&.first
    next unless lottery&.running?
    
    Rails.logger.info "LotteryPlugin: Lottery post edited, checking for updates"
    
    # 检查是否在后悔期内
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
          
          lottery = LotteryCreator.new(topic, lottery_data, user).create
          
          Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
          Rails.logger.info "CreateLottery Job: Scheduled draw job for #{lottery.draw_time}"
          
          lock_delay = SiteSetting.lottery_post_lock_delay_minutes
          if lock_delay > 0
            lock_time = lottery.created_at + lock_delay.minutes
            Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
            Rails.logger.info "CreateLottery Job: Scheduled lock job for #{lock_time}"
          end
          
          Rails.logger.info "CreateLottery Job: Successfully created lottery #{lottery.id}"
        rescue => e
          Rails.logger.error "CreateLottery Job: Failed: #{e.message}"
          Rails.logger.error "CreateLottery Job: #{e.backtrace.join("\n")}"
          
          Jobs.enqueue(:post_lottery_error, {
            topic_id: topic_id,
            error_message: e.message
          })
        end
      end
    end

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
          # 应该锁定 post 而不是 topic
          post = lottery.post
          
          # 使用 PostGuard 来锁定帖子
          Guardian.new(Discourse.system_user).ensure_can_lock!(post)
          post.update_locked(Discourse.system_user, true)

          PostCreator.create!(
            Discourse.system_user,
            topic_id: lottery.topic_id,
            raw: "🔒 抽奖信息已锁定，不允许再次编辑。如需修改，请联系管理员。"
          )
          
          Rails.logger.info "LockLotteryPost Job: Locked post for lottery #{lottery_id}"
        rescue => e
          Rails.logger.error "LockLotteryPost Job: Failed: #{e.message}"
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
          
          Rails.logger.info "ExecuteLotteryDraw Job: Draw completed with result: #{result}"
        rescue => e
          Rails.logger.error "ExecuteLotteryDraw Job: Failed: #{e.message}"
          Rails.logger.error "ExecuteLotteryDraw Job: #{e.backtrace.join("\n")}"
          
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
          
          lottery_data = extract_lottery_data_from_content(post.raw)
          
          if lottery_data.present?
            LotteryCreator.new(lottery.topic, lottery_data, lottery.user).update_existing(lottery)
            
            Rails.logger.info "UpdateLotteryFromEdit Job: Updated lottery successfully"
          else
            Rails.logger.warn "UpdateLotteryFromEdit Job: No valid lottery data found in edited content"
          end
        rescue => e
          Rails.logger.error "UpdateLotteryFromEdit Job: Failed: #{e.message}"
        end
      end

      private

      def extract_lottery_data_from_content(content)
        match = content.match(/\[lottery\](.*?)\[\/lottery\]/m)
        return nil unless match

        lottery_content = match[1]
        data = {}

        lottery_content.split("\n").each do |line|
          line = line.strip
          next if line.empty?
          
          if line.include?('：')
            key, value = line.split('：', 2)
            case key.strip
            when '活动名称' then data['prize_name'] = value.strip
            when '奖品说明' then data['prize_details'] = value.strip
            when '开奖时间' then data['draw_time'] = value.strip
            when '获奖人数' then data['winners_count'] = value.strip.to_i
            when '指定楼层' then data['specified_posts'] = value.strip
            when '参与门槛' then data['min_participants'] = value.gsub(/[^\d]/, '').to_i
            when '补充说明' then data['additional_notes'] = value.strip
            when '奖品图片' then data['prize_image'] = value.strip
            end
          end
        end
        data['backup_strategy'] ||= 'continue'
        data
      end
    end
  end
  
  Rails.logger.info "LotteryPlugin: Job classes defined"
  Rails.logger.info "LotteryPlugin: Initialization completed successfully"
end
