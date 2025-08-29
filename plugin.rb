# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1.1
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
  # 扩展序列化器 (修正: 增加对nil数据的安全处理)
  # ===================================================================
  add_to_serializer(:topic_view, :lottery_data) do
    lottery = object.topic.lotteries.first
    return nil unless lottery

    {
      id: lottery.id,
      prize_name: lottery.prize_name,
      prize_details: lottery.prize_details,
      draw_time: lottery.draw_time&.iso8601, # <--- 关键修正
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
    return nil unless post&.topic && post.post_number == 1 && post.topic.lotteries.exists?
    
    lottery = post.topic.lotteries.first
    return nil unless lottery

    {
      id: lottery.id,
      prize_name: lottery.prize_name,
      prize_details: lottery.prize_details,
      draw_time: lottery.draw_time&.iso8601, # <--- 关键修正
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
  
  # ... 此处省略和上次完全相同的代码 ...
  
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
    has_many :lotteries, dependent: :destroy
  end
  Rails.logger.info "LotteryPlugin: Added lotteries association to Post"

  User.class_eval do
    has_many :lotteries, foreign_key: :user_id, dependent: :destroy
  end
  Rails.logger.info "LotteryPlugin: Added lotteries association to User"
  
  # 监听话题创建事件
  DiscourseEvent.on(:topic_created) do |topic, params, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created #{topic.id}, checking for lottery data"
    
    lottery_data_json = params[:custom_fields]&.[]('lottery')
    
    if lottery_data_json.present?
      Rails.logger.info "LotteryPlugin: Found lottery data: #{lottery_data_json}"
      
      begin
        lottery_data = JSON.parse(lottery_data_json)
        Rails.logger.info "LotteryPlugin: Parsed lottery data: #{lottery_data.inspect}"
        
        Jobs.enqueue_in(2.seconds, :create_lottery, {
          topic_id: topic.id,
          lottery_data: lottery_data,
          user_id: user.id
        })
        
        Rails.logger.info "LotteryPlugin: Enqueued lottery creation job for topic #{topic.id}"
      rescue JSON::ParserError => e
        Rails.logger.error "LotteryPlugin: Failed to parse lottery JSON: #{e.message}"
        
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
          post = lottery.post
          
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
