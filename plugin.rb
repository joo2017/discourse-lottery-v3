# name: discourse-lottery-v3
# about: A comprehensive lottery plugin based on discourse-calendar patterns
# version: 0.3.3
# authors: [Your Name]
# url: https://github.com/joo2017/discourse-lottery-v3
# required_version: 3.1.0

enabled_site_setting :lottery_enabled

register_asset "stylesheets/lottery-modal.scss"
register_asset "stylesheets/lottery-form.scss"
register_asset "stylesheets/lottery-display.scss"

register_svg_icon "dice"

# CSP扩展支持 - 允许必要的外部资源
extend_content_security_policy(
  # 如果需要从外部加载图片，可以添加域名
  img_src: %w[data: blob:],
  # 如果需要连接外部API
  connect_src: %w[self],
  # 允许样式内联（如果必要）
  style_src: %w[self 'unsafe-inline']
)

after_initialize do
  Rails.logger.info "🎲 LotteryPlugin: Starting CSP-compliant initialization"

  # ===================================================================
  # 1. 自定义字段注册
  # ===================================================================
  
  module ::DiscourseLottery
    PLUGIN_NAME = "discourse-lottery-v3"
    LOTTERY_CUSTOM_FIELD = "lottery_data"
    TOPIC_LOTTERY_FIELD = "topic_lottery_data"
  end
  
  register_post_custom_field_type(DiscourseLottery::LOTTERY_CUSTOM_FIELD, :json)
  register_topic_custom_field_type(DiscourseLottery::TOPIC_LOTTERY_FIELD, :string)
  add_preloaded_topic_list_custom_field(DiscourseLottery::TOPIC_LOTTERY_FIELD)

  Rails.logger.info "🎲 LotteryPlugin: Custom fields registered"

  # ===================================================================
  # 2. 模型加载
  # ===================================================================
  
  plugin_path = File.dirname(__FILE__)
  [
    "#{plugin_path}/lib/lottery.rb",
    "#{plugin_path}/lib/lottery_creator.rb", 
    "#{plugin_path}/lib/lottery_manager.rb"
  ].each do |file_path|
    if File.exist?(file_path)
      load file_path
      Rails.logger.debug "🎲 Loaded: #{file_path}"
    end
  end

  # ===================================================================
  # 3. 模型关联
  # ===================================================================
  
  if ActiveRecord::Base.connection.table_exists?('lotteries')
    Topic.class_eval do
      has_many :lotteries, dependent: :destroy
    end

    Post.class_eval do 
      has_many :lotteries, dependent: :destroy
      
      def lottery
        @lottery ||= lotteries.first
      end
      
      def has_lottery?
        lottery.present?
      end
    end

    User.class_eval do
      has_many :lotteries, foreign_key: :user_id, dependent: :destroy
    end
  end

  # ===================================================================
  # 4. 事件处理
  # ===================================================================
  
  on(:post_created) do |post|
    next unless SiteSetting.lottery_enabled
    DiscourseLottery::LotteryProcessor.update_from_raw(post) if defined?(DiscourseLottery::LotteryProcessor)
  end

  on(:post_edited) do |post|
    next unless SiteSetting.lottery_enabled
    DiscourseLottery::LotteryProcessor.update_from_raw(post) if defined?(DiscourseLottery::LotteryProcessor)
  end

  on(:post_destroyed) do |post|
    if SiteSetting.lottery_enabled && post.lottery
      post.lottery.update!(status: 'cancelled')
    end
  end

  # ===================================================================
  # 5. 序列化器
  # ===================================================================
  
  add_to_serializer(
    :post,
    :lottery,
    include_condition: -> do
      SiteSetting.lottery_enabled && 
      object.post_number == 1 && 
      !object.nil? && 
      !object.deleted_at.present? &&
      object.has_lottery?
    end
  ) do
    if object.lottery
      {
        id: object.lottery.id,
        prize_name: object.lottery.prize_name,
        prize_details: object.lottery.prize_details,
        draw_time: object.lottery.draw_time&.iso8601,
        winners_count: object.lottery.winners_count,
        min_participants: object.lottery.min_participants,
        lottery_type: object.lottery.lottery_type,
        status: object.lottery.status,
        participants_count: object.lottery.try(:participants_count) || 0
      }
    end
  end

  add_to_serializer(
    :topic_view,
    :lottery,
    include_condition: -> do
      SiteSetting.lottery_enabled && object.topic&.first_post&.has_lottery?
    end
  ) do
    first_post = object.topic.first_post
    if first_post&.lottery
      lottery = first_post.lottery
      {
        id: lottery.id,
        prize_name: lottery.prize_name,
        prize_details: lottery.prize_details,
        draw_time: lottery.draw_time&.iso8601,
        winners_count: lottery.winners_count,
        min_participants: lottery.min_participants,
        lottery_type: lottery.lottery_type,
        status: lottery.status,
        participants_count: lottery.try(:participants_count) || 0,
        can_edit: lottery.try(:in_regret_period?) || false
      }
    end
  end

  # ===================================================================
  # 6. 内容处理器
  # ===================================================================
  
  module ::DiscourseLottery
    class LotteryProcessor
      def self.update_from_raw(post)
        return unless post.is_first_post?
        return unless post.raw.present?
        
        Rails.logger.info "🎲 LotteryProcessor: Processing post #{post.id}"
        
        lottery_match = post.raw.match(/\[lottery\](.*?)\[\/lottery\]/m)
        
        if lottery_match
          Rails.logger.info "🎲 Found lottery content in post #{post.id}"
          process_lottery_content(post, lottery_match[1])
        else
          remove_existing_lottery(post)
        end
      end

      private

      def self.process_lottery_content(post, content)
        begin
          lottery_data = parse_lottery_content(content)
          return unless lottery_data

          validate_lottery_data(lottery_data)

          lottery = post.lottery || post.lotteries.build
          
          if lottery.persisted?
            update_existing_lottery(lottery, lottery_data, post.user)
          else
            create_new_lottery(lottery, lottery_data, post)
          end

        rescue => e
          Rails.logger.error "🎲 LotteryProcessor error: #{e.message}"
          create_error_reply(post, e.message)
        end
      end

      def self.parse_lottery_content(content)
        data = {}
        content.split("\n").each do |line|
          line = line.strip
          next unless line.include?('：')
          
          key, value = line.split('：', 2)
          key, value = key.strip, value&.strip
          
          case key
          when '活动名称' then data[:prize_name] = value
          when '奖品说明' then data[:prize_details] = value  
          when '开奖时间' then data[:draw_time] = value
          when '获奖人数' then data[:winners_count] = value.to_i
          when '指定楼层', '指定中奖楼层' then data[:specified_posts] = value if value.present?
          when '参与门槛' 
            match = value&.match(/\d+/)
            data[:min_participants] = match[0].to_i if match
          when '补充说明' then data[:additional_notes] = value if value.present?
          when '奖品图片' then data[:prize_image] = value if value.present?
          end
        end
        
        return nil if data[:prize_name].blank? || data[:prize_details].blank? || data[:draw_time].blank?
        
        data[:backup_strategy] = 'continue'
        data[:lottery_type] = data[:specified_posts].present? ? 'specified' : 'random'
        data
      end

      def self.validate_lottery_data(data)
        raise "活动名称不能为空" if data[:prize_name].blank?
        raise "奖品说明不能为空" if data[:prize_details].blank?
        raise "开奖时间不能为空" if data[:draw_time].blank?

        begin
          draw_time = DateTime.parse(data[:draw_time])
          raise "开奖时间必须是未来时间" if draw_time <= Time.current
        rescue ArgumentError
          raise "开奖时间格式无效"
        end

        global_min = SiteSetting.lottery_min_participants_global || 5
        if data[:min_participants] < global_min
          raise "参与门槛不能低于全局设置的 #{global_min} 人"
        end
      end

      def self.create_new_lottery(lottery, data, post)
        lottery.assign_attributes(
          topic_id: post.topic_id,
          post_id: post.id,
          user_id: post.user_id,
          prize_name: data[:prize_name],
          prize_details: data[:prize_details],
          draw_time: DateTime.parse(data[:draw_time]),
          winners_count: data[:winners_count] || 1,
          min_participants: data[:min_participants],
          lottery_type: data[:lottery_type],
          specified_post_numbers: data[:specified_posts],
          status: 'running'
        )

        lottery.additional_notes = data[:additional_notes] if lottery.respond_to?(:additional_notes=)
        lottery.prize_image = data[:prize_image] if lottery.respond_to?(:prize_image=)

        if lottery.save
          Rails.logger.info "🎲 Created lottery #{lottery.id} for post #{post.id}"
          
          schedule_lottery_tasks(lottery)
          add_lottery_tag(post.topic)
          
          post.topic.custom_fields[DiscourseLottery::TOPIC_LOTTERY_FIELD] = 'active'
          post.topic.save_custom_fields
        else
          raise "保存失败: #{lottery.errors.full_messages.join(', ')}"
        end
      end

      def self.update_existing_lottery(lottery, data, user)
        return unless lottery.try(:in_regret_period?)
        
        lottery.update!(
          prize_name: data[:prize_name],
          prize_details: data[:prize_details],
          draw_time: DateTime.parse(data[:draw_time]),
          winners_count: data[:winners_count] || 1,
          min_participants: data[:min_participants],
          lottery_type: data[:lottery_type],
          specified_post_numbers: data[:specified_posts]
        )
        
        Rails.logger.info "🎲 Updated lottery #{lottery.id}"
      end

      def self.remove_existing_lottery(post)
        return unless post.lottery
        
        post.lottery.update!(status: 'cancelled')
        Rails.logger.info "🎲 Cancelled lottery for post #{post.id}"
      end

      def self.schedule_lottery_tasks(lottery)
        Jobs.enqueue_at(lottery.draw_time, :execute_lottery_draw, lottery_id: lottery.id)
        
        lock_delay = SiteSetting.lottery_post_lock_delay_minutes
        if lock_delay > 0
          lock_time = lottery.created_at + lock_delay.minutes
          Jobs.enqueue_at(lock_time, :lock_lottery_post, lottery_id: lottery.id)
        end
      end

      def self.add_lottery_tag(topic)
        begin
          lottery_tag = Tag.find_or_create_by!(name: '抽奖中')
          topic.tags << lottery_tag unless topic.tags.include?(lottery_tag)
          topic.save!
        rescue => e
          Rails.logger.warn "🎲 Failed to add lottery tag: #{e.message}"
        end
      end

      def self.create_error_reply(post, error_message)
        PostCreator.create!(
          Discourse.system_user,
          topic_id: post.topic_id,
          raw: "🚫 **抽奖创建失败**\n\n#{error_message}\n\n请检查抽奖信息格式并重新编辑。"
        )
      rescue => e
        Rails.logger.error "🎲 Failed to create error reply: #{e.message}"
      end
    end
  end

  # ===================================================================
  # 7. 后台任务
  # ===================================================================
  
  module ::Jobs
    class ExecuteLotteryDraw < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          return unless defined?(Lottery) && ActiveRecord::Base.connection.table_exists?('lotteries')
          
          lottery = Lottery.find(lottery_id)
          return unless lottery.try(:can_draw?)
          
          if defined?(LotteryManager)
            manager = LotteryManager.new(lottery)
            manager.execute_draw
          end
          
        rescue => e
          Rails.logger.error "🎲 ExecuteLotteryDraw: #{e.message}"
        end
      end
    end

    class LockLotteryPost < ::Jobs::Base
      def execute(args)
        lottery_id = args[:lottery_id]
        
        begin
          return unless defined?(Lottery) && ActiveRecord::Base.connection.table_exists?('lotteries')
          
          lottery = Lottery.find(lottery_id)
          return unless lottery.try(:running?)
          
          lottery.post.update!(locked_by_id: Discourse.system_user.id)
          
        rescue => e
          Rails.logger.error "🎲 LockLotteryPost: #{e.message}"
        end
      end
    end
  end

  Rails.logger.info "🎲 LotteryPlugin: CSP-compliant initialization complete"
end
