# name: discourse-lottery-v3
# about: A comprehensive lottery plugin following discourse-calendar patterns
# version: 0.3.2
# authors: [Your Name]
# url: https://github.com/joo2017/discourse-lottery-v3
# required_version: 3.1.0

enabled_site_setting :lottery_enabled

register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"

register_svg_icon "dice"

after_initialize do
  Rails.logger.info "🎲 LotteryPlugin: Starting initialization based on discourse-calendar patterns"

  # ===================================================================
  # 模块定义 - 仿照discourse-calendar的模块结构
  # ===================================================================
  
  module ::DiscourseLottery
    PLUGIN_NAME = "discourse-lottery-v3"
    LOTTERY_CUSTOM_FIELD = "lottery"
    LOTTERY_DATA_CUSTOM_FIELD = "lottery_data"
  end

  # ===================================================================
  # 加载依赖文件 - 参照discourse-calendar的加载方式
  # ===================================================================
  
  [
    "lib/lottery",
    "lib/lottery_creator", 
    "lib/lottery_manager"
  ].each do |path|
    load File.expand_path("../#{path}.rb", __FILE__)
  end

  # ===================================================================
  # 自定义字段注册 - 完全按照discourse-calendar的方式
  # ===================================================================
  
  register_post_custom_field_type(DiscourseLottery::LOTTERY_CUSTOM_FIELD, :string)
  register_post_custom_field_type(DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD, :json)
  
  # 添加到默认的post custom fields - 仿照calendar插件
  TopicView.default_post_custom_fields << DiscourseLottery::LOTTERY_CUSTOM_FIELD
  TopicView.default_post_custom_fields << DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD

  # ===================================================================
  # 模型扩展 - 采用discourse-calendar的扩展模式
  # ===================================================================
  
  # 等待表创建后再建立关联
  if ActiveRecord::Base.connection.table_exists?('lotteries')
    Topic.class_eval do
      has_many :lotteries, dependent: :destroy
      
      def has_lottery?
        first_post&.custom_fields&.[](DiscourseLottery::LOTTERY_CUSTOM_FIELD).present? ||
        lotteries.exists?
      end
    end

    Post.class_eval do
      has_many :lotteries, dependent: :destroy
      
      def lottery
        custom_fields[DiscourseLottery::LOTTERY_CUSTOM_FIELD]
      end
      
      def lottery_data
        custom_fields[DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD]
      end
    end

    User.class_eval do
      has_many :lotteries, foreign_key: :user_id, dependent: :destroy
    end
  end

  # ===================================================================
  # 序列化器 - 仿照discourse-calendar的序列化模式
  # ===================================================================
  
  add_to_serializer(:post, :lottery, include_condition: -> {
    object.post_number == 1 && object.custom_fields[DiscourseLottery::LOTTERY_CUSTOM_FIELD].present?
  }) do
    object.custom_fields[DiscourseLottery::LOTTERY_CUSTOM_FIELD]
  end

  add_to_serializer(:post, :lottery_data, include_condition: -> {
    object.post_number == 1 && object.custom_fields[DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD].present?
  }) do
    # 如果数据库表存在，优先从数据库获取最新数据
    if ActiveRecord::Base.connection.table_exists?('lotteries') && object.topic.lotteries.exists?
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
        additional_notes: lottery.try(:additional_notes),
        prize_image: lottery.try(:prize_image)
      }
    else
      # 备用：从custom_fields获取
      object.custom_fields[DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD]
    end
  end

  # ===================================================================
  # 事件处理 - 采用discourse-calendar的事件处理模式
  # ===================================================================
  
  # 参照discourse-calendar，监听post_created而不是topic_created
  on(:post_created) do |post, opts, user|
    next unless SiteSetting.lottery_enabled
    next unless post.is_first_post?
    
    begin
      # 检查是否有抽奖数据
      lottery_data = extract_lottery_data_from_post(post, opts)
      
      if lottery_data.present?
        Rails.logger.info "🎲 Processing lottery for post #{post.id}"
        
        # 设置custom_fields
        post.custom_fields[DiscourseLottery::LOTTERY_CUSTOM_FIELD] = "true"
        post.custom_fields[DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD] = lottery_data
        post.save_custom_fields
        
        # 异步处理抽奖创建
        Jobs.enqueue(:process_lottery_creation, {
          topic_id: post.topic_id,
          post_id: post.id,
          lottery_data: lottery_data.to_json,
          user_id: user.id
        })
      end
    rescue => e
      Rails.logger.error "🎲 Error in post_created handler: #{e.message}"
    end
  end

  # 监听帖子编辑 - 参照discourse-calendar的编辑处理
  on(:post_edited) do |post, topic_changed, user|
    next unless SiteSetting.lottery_enabled
    next unless post.is_first_post?
    next unless post.custom_fields[DiscourseLottery::LOTTERY_CUSTOM_FIELD].present?
    
    begin
      if ActiveRecord::Base.connection.table_exists?('lotteries')
        lottery = post.topic.lotteries.where(status: 'running').first
        next unless lottery&.in_regret_period?
        
        # 重新解析帖子内容
        new_lottery_data = extract_lottery_data_from_content(post.raw)
        
        if new_lottery_data.present?
          post.custom_fields[DiscourseLottery::LOTTERY_DATA_CUSTOM_FIELD] = new_lottery_data
          post.save_custom_fields
          
          Jobs.enqueue(:update_lottery_from_edit, {
            lottery_id: lottery.id,
            post_id: post.id,
            lottery_data: new_lottery_data.to_json
          })
        end
      end
    rescue => e
      Rails.logger.error "🎲 Error in post_edited handler: #{e.message}"
    end
  end

  # ===================================================================
  # 数据提取辅助方法 - 仿照discourse-calendar的数据处理
  # ===================================================================
  
  def extract_lottery_data_from_post(post, opts)
    # 方法1：从opts获取（composer传递）
    if opts && opts[:lottery]
      data = opts[:lottery]
      return data.is_a?(String) ? JSON.parse(data) : data
    end
    
    # 方法2：从帖子内容解析
    return extract_lottery_data_from_content(post.raw) if post.raw.present?
    
    nil
  rescue JSON::ParserError => e
    Rails.logger.warn "🎲 JSON parse error: #{e.message}"
    extract_lottery_data_from_content(post.raw) if post.raw.present?
  end
  
  def extract_lottery_data_from_content(content)
    return nil unless content.present?
    
    match = content.match(/\[lottery\](.*?)\[\/lottery\]/m)
    return nil unless match
    
    data = {}
    match[1].split("\n").each do |line|
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
    
    data['backup_strategy'] = 'continue'
    data.present? ? data : nil
  end

  # ===================================================================
  # 后台任务 - 采用discourse-calendar的Jobs模式
  # ===================================================================
  
  module ::Jobs
    class ProcessLotteryCreation < ::Jobs::Base
      def execute(args)
        topic_id, post_id, user_id = args.values_at(:topic_id, :post_id, :user_id)
        lottery_data = args[:lottery_data]
        
        Rails.logger.info "🎲 ProcessLotteryCreation: Processing post #{post_id}"
        
        begin
          topic = Topic.find(topic_id)
          post = Post.find(post_id) 
          user = User.find(user_id)
          
          # 解析数据
          parsed_data = JSON.parse(lottery_data).with_indifferent_access
          
          # 检查是否已存在抽奖（避免重复创建）
          if ActiveRecord::Base.connection.table_exists?('lotteries') && 
             topic.lotteries.exists?
            Rails.logger.warn "🎲 Lottery already exists for topic #{topic_id}"
            return
          end
          
          # 创建抽奖记录
          if defined?(LotteryCreator)
            lottery = LotteryCreator.new(topic, parsed_data, user).create
            
            # 调度任务
            schedule_lottery_tasks(lottery)
            
            # 通知前端
            MessageBus.publish("/topic/#{topic.id}", {
              type: "lottery_created",
              lottery_id: lottery.id,
              topic_id: topic.id
            })
            
            Rails.logger.info "🎲 ProcessLotteryCreation: Success for lottery #{lottery.id}"
          else
            Rails.logger.error "🎲 LotteryCreator class not available"
          end
          
        rescue => e
          Rails.logger.error "🎲 ProcessLotteryCreation: #{e.message}"
          post_error_to_topic(topic_id, e.message)
        end
      end

      private

      def schedule_lottery_tasks(lottery)
        # 开奖任务
        Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
        
        # 锁定任务
        lock_delay = SiteSetting.lottery_post_lock_delay_minutes || 30
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

    class ExecuteLotteryDraw < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          return unless ActiveRecord::Base.connection.table_exists?('lotteries')
          return unless defined?(Lottery) && defined?(LotteryManager)
          
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
        end
      end
    end

    class LockLotteryPost < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          return unless ActiveRecord::Base.connection.table_exists?('lotteries')
          return unless defined?(Lottery)
          
          lottery = Lottery.find(lottery_id)
          return unless lottery.status == 'running'
          
          post = lottery.post
          post.update!(locked_by_id: Discourse.system_user.id)
          
          Rails.logger.info "🎲 LockLotteryPost: Locked post for lottery #{lottery_id}"
          
        rescue => e
          Rails.logger.error "🎲 LockLotteryPost: #{e.message}"
        end
      end
    end

    class UpdateLotteryFromEdit < ::Jobs::Base
      def execute(args)
        lottery_id, lottery_data = args.values_at(:lottery_id, :lottery_data)
        
        begin
          return unless ActiveRecord::Base.connection.table_exists?('lotteries')
          return unless defined?(Lottery) && defined?(LotteryCreator)
          
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

  Rails.logger.info "🎲 LotteryPlugin: Initialization complete using discourse-calendar patterns"
end
