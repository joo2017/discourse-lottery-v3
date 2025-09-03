# ====================================================================
# 1. 修复 plugin.rb - 核心数据传递逻辑
# ====================================================================

# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, following official 2025 best practices
# version: 0.2.0
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss" 
register_asset "stylesheets/lottery-display.scss"

register_svg_icon "dice"

after_initialize do
  Rails.logger.info "LotteryPlugin: Starting initialization with data reliability fixes"

  # ===================================================================
  # 官方推荐：使用正确的自定义字段注册方式
  # ===================================================================
  
  register_topic_custom_field_type('lottery', :json)
  register_post_custom_field_type('lottery_data', :json)
  
  # 官方推荐：允许参数传递 - 但不完全依赖
  add_permitted_post_create_param('lottery')
  
  # 官方推荐：为列表显示预加载自定义字段
  add_preloaded_topic_list_custom_field('lottery')

  Rails.logger.info "LotteryPlugin: Custom fields registered using official methods"

  # ===================================================================
  # 模型扩展 - 使用官方推荐的 add_to_class 方法
  # ===================================================================
  
  add_to_class(:topic, :lottery_data) do
    @lottery_data ||= custom_fields['lottery'].present? ? JSON.parse(custom_fields['lottery']) : nil
  rescue JSON::ParserError
    nil
  end
  
  add_to_class(:topic, "lottery_data=") do |value|
    if value.nil?
      custom_fields['lottery'] = nil
    else
      custom_fields['lottery'] = value.is_a?(String) ? value : value.to_json
    end
  end

  # ===================================================================
  # 扩展序列化器 - 官方标准方式
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

  # ===================================================================
  # 使用 Rails 自动加载加载模型和服务
  # ===================================================================
  
  begin
    require_relative 'lib/lottery'
    require_relative 'lib/lottery_creator'
    require_relative 'lib/lottery_manager'
    Rails.logger.info "LotteryPlugin: Loaded models and services"
  rescue => e
    Rails.logger.error "LotteryPlugin: Failed to load models: #{e.message}"
  end
  
  # ===================================================================
  # 模型关联和扩展
  # ===================================================================
  
  module LotteryTopicExtension
    def has_lottery?
      lotteries.exists?
    end
    
    def active_lottery
      lotteries.where(status: 'running').first
    end
  end
  
  module LotteryPostExtension
    def is_lottery_post?
      post_number == 1 && topic&.has_lottery?
    end
  end
  
  module LotteryUserExtension
    def created_lotteries
      lotteries.order(created_at: :desc)
    end
  end
  
  ::Topic.class_eval do
    has_many :lotteries, dependent: :destroy
    prepend LotteryTopicExtension
  end

  ::Post.class_eval do
    has_many :lotteries, dependent: :destroy
    prepend LotteryPostExtension
  end

  ::User.class_eval do
    has_many :lotteries, foreign_key: :user_id, dependent: :destroy
    prepend LotteryUserExtension
  end
  
  Rails.logger.info "LotteryPlugin: Model associations and extensions added"

  # ===================================================================
  # 关键修复：数据传递可靠性保障机制
  # ===================================================================
  
  # 核心函数：多源数据提取（学习poll插件模式）
  def self.extract_lottery_data_reliably(topic, opts, user)
    Rails.logger.info "LotteryPlugin: Extracting lottery data from multiple sources"
    
    lottery_data = nil
    source_info = "unknown"
    
    # 数据源优先级（按可靠性排序）
    
    # 方法1：从帖子内容解析（最可靠 - poll插件主要方式）
    if topic&.first_post&.raw.present?
      raw_content = topic.first_post.raw
      if raw_content.include?('[lottery]') && raw_content.include?('[/lottery]')
        lottery_match = raw_content.match(/\[lottery\](.*?)\[\/lottery\]/m)
        if lottery_match
          lottery_data = parse_lottery_content_to_json(lottery_match[1])
          source_info = "raw_content" if lottery_data
          Rails.logger.info "LotteryPlugin: Found lottery data in raw content"
        end
      end
    end
    
    # 方法2：从opts参数获取（次可靠 - 辅助方式）
    if lottery_data.blank? && opts.present?
      if opts[:lottery].present?
        lottery_data = opts[:lottery]
        source_info = "opts_lottery"
        Rails.logger.info "LotteryPlugin: Found lottery data in opts[:lottery]"
      elsif opts[:custom_fields].present? && opts[:custom_fields]['lottery'].present?
        lottery_data = opts[:custom_fields]['lottery']
        source_info = "opts_custom_fields"
        Rails.logger.info "LotteryPlugin: Found lottery data in opts[:custom_fields]"
      end
    end
    
    # 方法3：从topic custom_fields获取（兜底方式）
    if lottery_data.blank? && topic.present?
      topic.reload
      if topic.custom_fields['lottery'].present?
        lottery_data = topic.custom_fields['lottery']
        source_info = "topic_custom_fields"
        Rails.logger.info "LotteryPlugin: Found lottery data in topic custom_fields"
      end
    end
    
    Rails.logger.info "LotteryPlugin: Data extraction result - Source: #{source_info}, Data present: #{lottery_data.present?}"
    
    return lottery_data, source_info
  end

  # 内容解析函数（poll插件模式）
  def self.parse_lottery_content_to_json(content)
    begin
      data = {}
      lines = content.to_s.split("\n")
      
      lines.each do |line|
        line = line.strip
        next unless line.present? && line.include?('：')
        
        key, value = line.split('：', 2)
        key = key.strip
        value = value.strip if value
        
        case key
        when '活动名称'
          data['prize_name'] = value
        when '奖品说明'
          data['prize_details'] = value
        when '开奖时间'
          data['draw_time'] = value
        when '获奖人数'
          data['winners_count'] = value.to_i if value
        when '指定楼层'
          data['specified_posts'] = value if value.present?
        when '参与门槛'
          match = value.match(/\d+/) if value
          data['min_participants'] = match[0].to_i if match
        when '后备策略'
          if value&.include?('取消')
            data['backup_strategy'] = 'cancel'
          else
            data['backup_strategy'] = 'continue'
          end
        when '补充说明'
          data['additional_notes'] = value if value.present?
        when '奖品图片'
          data['prize_image'] = value if value.present?
        end
      end
      
      # 设置默认值
      data['backup_strategy'] = 'continue' unless data['backup_strategy']
      
      Rails.logger.debug "LotteryPlugin: Parsed lottery data: #{data}"
      data
    rescue => e
      Rails.logger.error "LotteryPlugin: Error parsing lottery content: #{e.message}"
      nil
    end
  end

  # ===================================================================
  # 修复版事件处理：学习poll插件的可靠性模式
  # ===================================================================
  
  # 主要事件：处理主题创建（关键修复）
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created event for #{topic.id}"
    
    # 使用多源可靠性提取
    lottery_data, source_info = extract_lottery_data_reliably(topic, opts, user)
    
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Processing lottery creation with data from #{source_info}"
      
      # 关键修复：使用延迟任务处理，传递稳定的标识而不是复杂数据
      Jobs.enqueue(:process_lottery_creation, {
        topic_id: topic.id,
        post_id: topic.first_post.id,
        user_id: user.id,
        source: source_info,
        # 不传递复杂的lottery_data，而是让任务重新提取
        raw_content: topic.first_post.raw
      })
      
      # 立即设置临时标记（避免重复处理）
      topic.custom_fields['lottery_processing'] = true
      topic.save_custom_fields(true)
      
    else
      Rails.logger.debug "LotteryPlugin: No lottery data found in topic creation"
    end
  end

  # 处理帖子编辑
  DiscourseEvent.on(:post_edited) do |post, topic_changed|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1
    
    lottery = post.topic&.active_lottery
    next unless lottery
    
    # 检查是否在允许编辑期内
    lock_delay = SiteSetting.lottery_post_lock_delay_minutes.minutes
    if lottery.created_at + lock_delay > Time.current
      Rails.logger.info "LotteryPlugin: Post edited within grace period, updating lottery"
      
      # 使用可靠的数据提取
      lottery_data, source_info = extract_lottery_data_reliably(post.topic, {}, lottery.user)
      
      if lottery_data.present?
        Jobs.enqueue(:update_lottery_from_edit, {
          lottery_id: lottery.id,
          post_id: post.id,
          raw_content: post.raw,
          source: source_info
        })
      end
    end
  end

  Rails.logger.info "LotteryPlugin: Event handlers registered with reliability fixes"

  # ===================================================================
  # 修复版后台任务：数据处理可靠性保障
  # ===================================================================
  
  module ::Jobs
    class ProcessLotteryCreation < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        post_id = args[:post_id]
        user_id = args[:user_id]
        source = args[:source]
        raw_content = args[:raw_content]
        
        Rails.logger.info "ProcessLotteryCreation: Starting for topic #{topic_id} from source #{source}"
        
        begin
          topic = Topic.find(topic_id)
          post = Post.find(post_id)
          user = User.find(user_id)
          
          # 清除临时处理标记
          topic.custom_fields.delete('lottery_processing')
          topic.save_custom_fields(true)
          
          # 关键修复：在任务中重新可靠提取数据
          lottery_data, actual_source = ::DiscoursePlugins::DiscourseAbTest.extract_lottery_data_reliably(topic, {}, user)
          
          unless lottery_data
            Rails.logger.error "ProcessLotteryCreation: Failed to extract lottery data in job"
            post_error_message(topic_id, "无法解析抽奖数据，请检查格式是否正确")
            return
          end
          
          Rails.logger.debug "ProcessLotteryCreation: Using data from #{actual_source}: #{lottery_data.inspect}"
          
          # 解析并验证数据
          parsed_data = normalize_lottery_data(lottery_data)
          validate_required_fields!(parsed_data)
          
          # 创建抽奖记录
          lottery = LotteryCreator.new(topic, parsed_data, user).create
          
          # 调度相关任务
          schedule_lottery_tasks(lottery)
          
          # 通知前端
          MessageBus.publish("/topic/#{topic.id}", {
            type: "lottery_created",
            lottery_id: lottery.id
          })
          
          Rails.logger.info "ProcessLotteryCreation: Successfully created lottery #{lottery.id}"
          
        rescue => e
          Rails.logger.error "ProcessLotteryCreation: Error: #{e.message}"
          Rails.logger.error "ProcessLotteryCreation: Backtrace: #{e.backtrace.join("\n")}"
          post_error_message(topic_id, e.message)
        end
      end

      private

      def normalize_lottery_data(lottery_data)
        case lottery_data
        when String
          begin
            JSON.parse(lottery_data).with_indifferent_access
          rescue JSON::ParserError
            # 如果不是JSON，当作raw content处理
            ::DiscoursePlugins::DiscourseAbTest.parse_lottery_content_to_json(lottery_data)&.with_indifferent_access
          end
        when Hash
          lottery_data.with_indifferent_access
        else
          Rails.logger.error "ProcessLotteryCreation: Unknown lottery_data type: #{lottery_data.class}"
          nil
        end
      end
      
      def validate_required_fields!(data)
        return unless data
        
        missing_fields = []
        
        missing_fields << '活动名称' if data[:prize_name].blank?
        missing_fields << '奖品说明' if data[:prize_details].blank?
        missing_fields << '开奖时间' if data[:draw_time].blank?
        
        if missing_fields.any?
          raise "缺少必填字段：#{missing_fields.join('、')}"
        end
        
        # 验证时间格式
        begin
          draw_time = DateTime.parse(data[:draw_time].to_s)
          if draw_time <= Time.current
            raise "开奖时间必须是未来时间"
          end
        rescue ArgumentError
          raise "开奖时间格式无效"
        end
        
        # 验证参与门槛
        min_participants = data[:min_participants].to_i
        global_min = SiteSetting.lottery_min_participants_global
        
        if min_participants < global_min
          raise "参与门槛不能低于全局设置的 #{global_min} 人"
        end
      end

      def schedule_lottery_tasks(lottery)
        # 调度开奖任务
        Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
        
        # 调度锁定任务（如果需要）
        lock_delay = SiteSetting.lottery_post_lock_delay_minutes
        if lock_delay > 0
          lock_time = lottery.created_at + lock_delay.minutes
          Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
        end
        
        Rails.logger.info "ProcessLotteryCreation: Scheduled background tasks"
      end

      def post_error_message(topic_id, error_message)
        begin
          PostCreator.create!(
            Discourse.system_user,
            topic_id: topic_id,
            raw: "🚫 **抽奖创建失败**\n\n#{error_message}\n\n请检查抽奖信息并重新创建。"
          )
        rescue => e
          Rails.logger.error "ProcessLotteryCreation: Failed to post error message: #{e.message}"
        end
      end
    end

    class UpdateLotteryFromEdit < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        post_id = args[:post_id]
        raw_content = args[:raw_content]
        source = args[:source]
        
        Rails.logger.info "UpdateLotteryFromEdit: Processing lottery #{lottery_id} from #{source}"
        
        begin
          lottery = Lottery.find(lottery_id)
          post = Post.find(post_id)
          
          # 重新从内容中提取数据
          lottery_data = nil
          if raw_content.include?('[lottery]')
            lottery_match = raw_content.match(/\[lottery\](.*?)\[\/lottery\]/m)
            if lottery_match
              lottery_data = ::DiscoursePlugins::DiscourseAbTest.parse_lottery_content_to_json(lottery_match[1])
            end
          end
          
          if lottery_data.present?
            parsed_data = lottery_data.with_indifferent_access
            LotteryCreator.new(lottery.topic, parsed_data, lottery.user).update_existing(lottery)
            
            MessageBus.publish("/topic/#{lottery.topic_id}", {
              type: "lottery_updated",
              lottery_id: lottery.id
            })
            
            Rails.logger.info "UpdateLotteryFromEdit: Successfully updated lottery #{lottery_id}"
          else
            Rails.logger.warn "UpdateLotteryFromEdit: No lottery data found in edited content"
          end
          
        rescue => e
          Rails.logger.error "UpdateLotteryFromEdit: Error: #{e.message}"
        end
      end
    end

    # 其他任务保持不变...
    class ExecuteLotteryDraw < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          Rails.logger.info "ExecuteLotteryDraw: Starting draw for lottery #{lottery_id}"
          
          manager = LotteryManager.new(lottery)
          result = manager.execute_draw
          
          MessageBus.publish("/topic/#{lottery.topic_id}", {
            type: "lottery_completed",
            lottery_id: lottery.id,
            status: lottery.status
          })
          
        rescue => e
          Rails.logger.error "ExecuteLotteryDraw: Error: #{e.message}"
          handle_draw_error(lottery_id, e)
        end
      end

      private

      def handle_draw_error(lottery_id, error)
        lottery = Lottery.find_by(id: lottery_id)
        return unless lottery
        
        lottery.update!(status: 'cancelled')
        
        PostCreator.create!(
          Discourse.system_user,
          topic_id: lottery.topic_id,
          raw: "❌ **开奖失败**\n\n系统在执行开奖时遇到错误。请联系管理员处理。"
        )
      end
    end

    class LockLotteryPost < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          post = lottery.post
          
          post.update!(locked_by_id: Discourse.system_user.id)
          
          PostCreator.create!(
            Discourse.system_user,
            topic_id: lottery.topic_id,
            raw: "🔒 抽奖信息已锁定，不允许再次编辑。"
          )
          
        rescue => e
          Rails.logger.error "LockLotteryPost: Error: #{e.message}"
        end
      end
    end
  end

  Rails.logger.info "LotteryPlugin: Job classes defined with reliability fixes"
  Rails.logger.info "LotteryPlugin: Initialization completed successfully with data reliability improvements"
end
