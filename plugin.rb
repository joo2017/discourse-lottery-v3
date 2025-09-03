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
  Rails.logger.info "LotteryPlugin: Starting initialization with official patterns"

  # ===================================================================
  # 官方推荐：使用正确的自定义字段注册方式
  # ===================================================================
  
  # 注册自定义字段类型（官方标准方式）
  register_topic_custom_field_type('lottery', :json)
  register_post_custom_field_type('lottery_data', :json)
  
  # 官方推荐：使用 add_permitted_post_create_param 允许参数传递
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
  # 官方推荐：使用模块 prepend 模式扩展模型
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
  
  # 使用官方推荐的 prepend 模式
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
  # 官方推荐：使用 DiscourseEvent 进行事件处理 - 修复版
  # ===================================================================
  
  # 主要事件：处理主题创建
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created event for #{topic.id}"
    Rails.logger.debug "LotteryPlugin: Opts keys: #{opts.keys.inspect if opts}"
    Rails.logger.debug "LotteryPlugin: Opts content: #{opts.inspect if opts}"
    
    lottery_data = nil
    
    # 方法1：从 opts 参数获取（最常用）
    if opts && opts[:lottery]
      lottery_data = opts[:lottery]
      Rails.logger.info "LotteryPlugin: Found lottery data in opts[:lottery]"
    end
    
    # 方法2：从 custom_fields 获取（备选）
    if lottery_data.blank? && opts && opts[:custom_fields] && opts[:custom_fields]['lottery']
      lottery_data = opts[:custom_fields]['lottery']
      Rails.logger.info "LotteryPlugin: Found lottery data in opts[:custom_fields]['lottery']"
    end
    
    # 方法3：从 topic custom_fields 获取（最后的备选方案）
    if lottery_data.blank?
      topic.reload
      lottery_data = topic.custom_fields['lottery']
      if lottery_data.present?
        Rails.logger.info "LotteryPlugin: Found lottery data in topic.custom_fields['lottery']"
      end
    end
    
    # 方法4：从帖子内容解析（终极备选方案）
    if lottery_data.blank?
      first_post = topic.first_post
      if first_post && first_post.raw.present?
        lottery_match = first_post.raw.match(/\[lottery\](.*?)\[\/lottery\]/m)
        if lottery_match
          Rails.logger.info "LotteryPlugin: Parsing lottery data from post content"
          lottery_data = parse_lottery_content_to_json(lottery_match[1])
        end
      end
    end
    
    # 如果找到了抽奖数据，就处理
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Processing lottery creation with data type: #{lottery_data.class}"
      Rails.logger.debug "LotteryPlugin: Lottery data content: #{lottery_data}"
      
      # 立即处理抽奖创建
      Jobs.enqueue(:process_lottery_creation, {
        topic_id: topic.id,
        post_id: topic.first_post.id,
        lottery_data: lottery_data,
        user_id: user.id
      })
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
      
      Jobs.enqueue(:update_lottery_from_edit, {
        lottery_id: lottery.id,
        post_id: post.id
      })
    end
  end

  Rails.logger.info "LotteryPlugin: Event handlers registered"

  # 新增：内容解析辅助方法
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
        when '补充说明'
          data['additional_notes'] = value if value.present?
        when '奖品图片'
          data['prize_image'] = value if value.present?
        end
      end
      
      # 设置默认值
      data['backup_strategy'] = 'continue' unless data['backup_strategy']
      
      Rails.logger.debug "LotteryPlugin: Parsed lottery data: #{data}"
      data.to_json
    rescue => e
      Rails.logger.error "LotteryPlugin: Error parsing lottery content: #{e.message}"
      nil
    end
  end

  # ===================================================================
  # 官方推荐：使用 Jobs 模块定义后台任务
  # ===================================================================
  
  module ::Jobs
    class ProcessLotteryCreation < ::Jobs::Base
      def execute(args)
        topic_id = args[:topic_id]
        post_id = args[:post_id]
        lottery_data = args[:lottery_data]
        user_id = args[:user_id]
        
        Rails.logger.info "ProcessLotteryCreation: Starting for topic #{topic_id}"
        Rails.logger.debug "ProcessLotteryCreation: Raw lottery_data: #{lottery_data.inspect}"
        Rails.logger.debug "ProcessLotteryCreation: lottery_data class: #{lottery_data.class}"
        
        begin
          topic = Topic.find(topic_id)
          post = Post.find(post_id)
          user = User.find(user_id)
          
          # 解析数据 - 增强处理不同格式
          parsed_data = parse_lottery_data(lottery_data)
          
          unless parsed_data
            raise "无法解析抽奖数据"
          end
          
          Rails.logger.debug "ProcessLotteryCreation: Parsed data: #{parsed_data.inspect}"
          
          # 验证必填字段
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

      def parse_lottery_data(lottery_data)
        Rails.logger.debug "ProcessLotteryCreation: Parsing lottery data of type: #{lottery_data.class}"
        
        case lottery_data
        when String
          # 尝试解析 JSON 字符串
          begin
            JSON.parse(lottery_data).with_indifferent_access
          rescue JSON::ParserError => e
            Rails.logger.warn "ProcessLotteryCreation: JSON parse error: #{e.message}, trying as raw content"
            # 如果不是 JSON，尝试当作内容解析
            parse_lottery_from_content(lottery_data)
          end
        when Hash
          lottery_data.with_indifferent_access
        else
          Rails.logger.error "ProcessLotteryCreation: Unknown lottery_data type: #{lottery_data.class}"
          nil
        end
      end
      
      def parse_lottery_from_content(content)
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
            data[:prize_name] = value
          when '奖品说明'
            data[:prize_details] = value
          when '开奖时间'
            data[:draw_time] = value
          when '获奖人数'
            data[:winners_count] = value.to_i if value
          when '指定楼层'
            data[:specified_posts] = value if value.present?
          when '参与门槛'
            match = value.match(/\d+/) if value
            data[:min_participants] = match[0].to_i if match
          when '补充说明'
            data[:additional_notes] = value if value.present?
          when '奖品图片'
            data[:prize_image] = value if value.present?
          end
        end
        
        # 设置默认值
        data[:backup_strategy] = 'continue' unless data[:backup_strategy]
        
        data.with_indifferent_access
      end
      
      def validate_required_fields!(data)
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

    class UpdateLotteryFromEdit < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        post_id = args[:post_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          post = Post.find(post_id)
          
          # 获取更新的数据
          topic = post.topic
          topic.reload
          
          new_lottery_data = topic.custom_fields['lottery']
          
          if new_lottery_data.present?
            parsed_data = if new_lottery_data.is_a?(String)
              JSON.parse(new_lottery_data)
            else
              new_lottery_data
            end
            
            LotteryCreator.new(topic, parsed_data, lottery.user).update_existing(lottery)
            
            MessageBus.publish("/topic/#{topic.id}", {
              type: "lottery_updated",
              lottery_id: lottery.id
            })
            
          end
        rescue => e
          Rails.logger.error "UpdateLotteryFromEdit: Error: #{e.message}"
        end
      end
    end
  end

  Rails.logger.info "LotteryPlugin: Job classes defined"
  Rails.logger.info "LotteryPlugin: Initialization completed successfully using official patterns"
end       
