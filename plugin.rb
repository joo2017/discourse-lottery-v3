# name: discourse-lottery-v3
# about: A comprehensive lottery plugin following Discourse 2025 best practices
# version: 0.3.0
# authors: [Your Name]
# url: https://github.com/joo2017/discourse-lottery-v3
# required_version: 3.1.0

enabled_site_setting :lottery_enabled

register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"

register_svg_icon "dice"

after_initialize do
  Rails.logger.info "🎲 LotteryPlugin: Starting initialization with 2025 standards"

  # =================================================================== 
  # 修复1: 正确的自定义字段注册（基于discourse-calendar模式）
  # ===================================================================
  
  # 注册自定义字段类型 - 使用最新API
  register_topic_custom_field_type('lottery_data', :json)
  register_post_custom_field_type('lottery_data', :json)
  
  # 修复：添加到白名单以便前端访问
  add_preloaded_topic_list_custom_field('lottery_data')
  
  # 修复：允许在创建时传递参数
  add_permitted_post_create_param('lottery')
  add_permitted_topic_create_param('lottery_data')

  Rails.logger.info "🎲 LotteryPlugin: Custom fields registered correctly"

  # ===================================================================
  # 修复2: 模型加载和关联（修复路径问题）
  # ===================================================================
  
  # 修复：使用相对路径加载模型
  [
    "#{Rails.root}/plugins/discourse-lottery-v3/lib/lottery.rb",
    "#{Rails.root}/plugins/discourse-lottery-v3/lib/lottery_creator.rb", 
    "#{Rails.root}/plugins/discourse-lottery-v3/lib/lottery_manager.rb"
  ].each do |file_path|
    if File.exist?(file_path)
      load file_path
      Rails.logger.debug "🎲 Loaded: #{file_path}"
    else
      Rails.logger.warn "🎲 File not found: #{file_path}"
    end
  end
  
  Rails.logger.info "🎲 LotteryPlugin: Models loaded"

  # ===================================================================
  # 修复3: 模型扩展（使用官方推荐方式）
  # ===================================================================
  
  # Topic扩展
  add_to_class(:topic, :lottery_data) do
    @lottery_data ||= begin
      data = custom_fields['lottery_data']
      data.present? ? (data.is_a?(String) ? JSON.parse(data) : data) : nil
    rescue JSON::ParserError => e
      Rails.logger.warn "🎲 Error parsing lottery_data: #{e.message}"
      nil
    end
  end
  
  add_to_class(:topic, "lottery_data=") do |value|
    if value.nil?
      custom_fields.delete('lottery_data')
    else
      custom_fields['lottery_data'] = value.is_a?(String) ? value : value.to_json
    end
    @lottery_data = nil # 清除缓存
  end
  
  add_to_class(:topic, :has_lottery?) do
    lottery_data.present? || (defined?(lotteries) && lotteries.exists?)
  end
  
  # 修复：建立正确的关联
  Topic.class_eval do
    has_many :lotteries, dependent: :destroy
  end

  Post.class_eval do
    has_many :lotteries, dependent: :destroy
  end

  User.class_eval do
    has_many :lotteries, foreign_key: :user_id, dependent: :destroy
  end

  Rails.logger.info "🎲 LotteryPlugin: Model associations established"

  # ===================================================================
  # 修复4: 序列化器优化（基于discourse-calendar最佳实践）
  # ===================================================================
  
  # 修复：Post序列化器 - 只在第一个帖子且有抽奖数据时显示
  add_to_serializer(:post, :lottery_data, include_condition: -> {
    object.post_number == 1 && object.topic&.has_lottery?
  }) do
    # 优先从数据库获取最新数据
    if object.topic.respond_to?(:lotteries) && object.topic.lotteries.exists?
      lottery = object.topic.lotteries.first
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
        prize_image: lottery.prize_image,
        participants_count: lottery.participants_count,
        can_edit: lottery.in_regret_period?
      }
    else
      # 备用：从custom_fields获取
      object.topic.lottery_data
    end
  end
  
  # 修复：TopicView序列化器
  add_to_serializer(:topic_view, :lottery_data, include_condition: -> {
    object.topic&.has_lottery?
  }) do
    if object.topic.respond_to?(:lotteries) && object.topic.lotteries.exists?
      lottery = object.topic.lotteries.first
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
        prize_image: lottery.prize_image,
        participants_count: lottery.participants_count,
        winner_users: lottery.finished? ? lottery.winner_users.map { |u| { id: u.id, username: u.username } } : []
      }
    else
      object.topic.lottery_data
    end
  end

  Rails.logger.info "🎲 LotteryPlugin: Serializers configured"

  # ===================================================================
  # 修复5: 事件处理（修复数据传递问题）
  # ===================================================================
  
  # 修复：主题创建事件处理
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "🎲 Topic created: #{topic.id}, checking for lottery data"
    
    # 修复：多渠道获取抽奖数据
    lottery_data = extract_lottery_data(topic, opts)
    
    if lottery_data.present?
      Rails.logger.info "🎲 Processing lottery for topic #{topic.id}"
      
      # 立即处理，避免延迟问题
      Jobs.enqueue(:process_lottery_creation, {
        topic_id: topic.id,
        post_id: topic.first_post&.id,
        lottery_data: lottery_data.is_a?(String) ? lottery_data : lottery_data.to_json,
        user_id: user.id
      })
    end
  end

  # 修复：帖子编辑事件（增加安全检查）
  DiscourseEvent.on(:post_edited) do |post, topic_changed, user|
    next unless SiteSetting.lottery_enabled
    next unless post.post_number == 1
    next unless post.topic&.has_lottery?
    
    begin
      # 检查是否有活跃的抽奖且在编辑期内
      if post.topic.lotteries.exists?
        lottery = post.topic.lotteries.running.first
        
        if lottery && lottery.in_regret_period?
          Rails.logger.info "🎲 Updating lottery #{lottery.id} from post edit"
          
          # 从帖子内容重新解析数据
          content_data = extract_lottery_from_content(post.raw)
          
          if content_data.present?
            Jobs.enqueue(:update_lottery_from_edit, {
              lottery_id: lottery.id,
              post_id: post.id,
              lottery_data: content_data.to_json
            })
          end
        end
      end
    rescue => e
      Rails.logger.error "🎲 Error in post_edited handler: #{e.message}"
    end
  end

  Rails.logger.info "🎲 LotteryPlugin: Event handlers registered"

  # ===================================================================
  # 修复6: 改进的数据提取方法
  # ===================================================================
  
  def self.extract_lottery_data(topic, opts)
    # 方法1：从opts直接获取
    return opts[:lottery] if opts&.dig(:lottery).present?
    return opts[:lottery_data] if opts&.dig(:lottery_data).present?
    
    # 方法2：从custom_fields获取  
    if opts&.dig(:custom_fields, 'lottery').present?
      return opts[:custom_fields]['lottery']
    end
    
    if opts&.dig(:custom_fields, 'lottery_data').present?
      return opts[:custom_fields]['lottery_data']
    end
    
    # 方法3：从topic的custom_fields获取
    if topic.custom_fields['lottery_data'].present?
      return topic.custom_fields['lottery_data']
    end
    
    # 方法4：从帖子内容解析
    first_post = topic.first_post || topic.ordered_posts.first
    return extract_lottery_from_content(first_post.raw) if first_post&.raw.present?
    
    nil
  end
  
  def self.extract_lottery_from_content(content)
    return nil unless content.present?
    
    match = content.match(/\[lottery\](.*?)\[\/lottery\]/m)
    return nil unless match
    
    parse_lottery_content(match[1])
  end
  
  def self.parse_lottery_content(content)
    data = {}
    content.split("\n").each do |line|
      line = line.strip
      next unless line.include?('：')
      
      key, value = line.split('：', 2)
      key, value = key.strip, value&.strip
      
      case key
      when '活动名称' then data['prize_name'] = value
      when '奖品说明' then data['prize_details'] = value  
      when '开奖时间' then data['draw_time'] = value
      when '获奖人数' then data['winners_count'] = value.to_i
      when '指定楼层', '指定中奖楼层' then data['specified_posts'] = value if value.present?
      when '参与门槛' 
        match = value&.match(/\d+/)
        data['min_participants'] = match[0].to_i if match
      when '补充说明' then data['additional_notes'] = value if value.present?
      when '奖品图片' then data['prize_image'] = value if value.present?
      end
    end
    
    data['backup_strategy'] = 'continue' # 默认值
    data.present? ? data : nil
  end

  # ===================================================================
  # 修复7: 后台任务优化
  # ===================================================================
  
  module ::Jobs
    # 修复：抽奖创建任务
    class ProcessLotteryCreation < ::Jobs::Base
      def execute(args)
        topic_id, post_id, user_id = args.values_at(:topic_id, :post_id, :user_id)
        lottery_data = args[:lottery_data]
        
        Rails.logger.info "🎲 ProcessLotteryCreation: Processing topic #{topic_id}"
        
        begin
          topic = Topic.find(topic_id)
          user = User.find(user_id)
          
          # 解析数据
          parsed_data = parse_lottery_data(lottery_data)
          raise "无法解析抽奖数据" unless parsed_data.present?
          
          # 创建抽奖
          lottery = LotteryCreator.new(topic, parsed_data, user).create
          
          # 调度任务
          schedule_tasks(lottery)
          
          # 通知前端
          MessageBus.publish("/topic/#{topic.id}", {
            type: "lottery_created",
            lottery_id: lottery.id,
            topic_id: topic.id
          })
          
          Rails.logger.info "🎲 ProcessLotteryCreation: Success for lottery #{lottery.id}"
          
        rescue => e
          Rails.logger.error "🎲 ProcessLotteryCreation: #{e.message}"
          post_error_to_topic(topic_id, e.message)
        end
      end

      private

      def parse_lottery_data(data)
        case data
        when String
          begin
            JSON.parse(data).with_indifferent_access
          rescue JSON::ParserError
            Rails.logger.warn "🎲 Invalid JSON, treating as raw content"
            nil
          end
        when Hash
          data.with_indifferent_access
        else
          nil
        end
      end

      def schedule_tasks(lottery)
        # 开奖任务
        Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
        
        # 锁定任务
        lock_delay = SiteSetting.lottery_post_lock_delay_minutes
        if lock_delay > 0
          lock_time = lottery.created_at + lock_delay.minutes
          Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
        end
      end

      def post_error_to_topic(topic_id, message)
        PostCreator.create!(
          Discourse.system_user,
          topic_id: topic_id,
          raw: "🚫 **抽奖创建失败**\n\n#{message}\n\n请检查抽奖信息格式并重新创建。"
        )
      rescue => e
        Rails.logger.error "🎲 Failed to post error: #{e.message}"
      end
    end

    # 修复：开奖执行任务
    class ExecuteLotteryDraw < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          Rails.logger.info "🎲 ExecuteLotteryDraw: Starting for #{lottery_id}"
          
          return unless lottery.can_draw?
          
          manager = LotteryManager.new(lottery)
          result = manager.execute_draw
          
          # 通知前端
          MessageBus.publish("/topic/#{lottery.topic_id}", {
            type: result[:cancelled] ? "lottery_cancelled" : "lottery_completed",
            lottery_id: lottery.id,
            topic_id: lottery.topic_id,
            status: lottery.status
          })
          
        rescue ActiveRecord::RecordNotFound
          Rails.logger.warn "🎲 ExecuteLotteryDraw: Lottery #{lottery_id} not found"
        rescue => e
          Rails.logger.error "🎲 ExecuteLotteryDraw: #{e.message}"
          handle_draw_error(lottery_id, e)
        end
      end

      private

      def handle_draw_error(lottery_id, error)
        begin
          lottery = Lottery.find(lottery_id)
          lottery.update!(status: 'cancelled')
          
          PostCreator.create!(
            Discourse.system_user,
            topic_id: lottery.topic_id,
            raw: "❌ **开奖执行失败**\n\n系统错误：#{error.message}\n\n请联系管理员处理。"
          )
        rescue => e
          Rails.logger.error "🎲 Failed to handle draw error: #{e.message}"
        end
      end
    end

    # 修复：帖子锁定任务
    class LockLotteryPost < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          lottery = Lottery.find(lottery_id)
          return unless lottery.running? # 只锁定进行中的抽奖
          
          post = lottery.post
          post.update!(locked_by_id: Discourse.system_user.id)
          
          Rails.logger.info "🎲 LockLotteryPost: Locked post for lottery #{lottery_id}"
          
        rescue => e
          Rails.logger.error "🎲 LockLotteryPost: #{e.message}"
        end
      end
    end

    # 修复：编辑更新任务
    class UpdateLotteryFromEdit < ::Jobs::Base
      def execute(args)
        lottery_id, lottery_data = args.values_at(:lottery_id, :lottery_data)
        
        begin
          lottery = Lottery.find(lottery_id)
          return unless lottery.in_regret_period?
          
          parsed_data = JSON.parse(lottery_data).with_indifferent_access
          LotteryCreator.new(lottery.topic, parsed_data, lottery.user).update_existing(lottery)
          
          MessageBus.publish("/topic/#{lottery.topic_id}", {
            type: "lottery_updated",
            lottery_id: lottery.id,
            topic_id: lottery.topic_id
          })
          
        rescue => e
          Rails.logger.error "🎲 UpdateLotteryFromEdit: #{e.message}"
        end
      end
    end
  end

  Rails.logger.info "🎲 LotteryPlugin: Jobs configured"
  Rails.logger.info "🎲 LotteryPlugin: Initialization complete using 2025 standards"
end
