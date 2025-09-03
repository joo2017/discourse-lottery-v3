# ====================================================================
# 修复 lib/lottery.rb - 增强模型的数据处理能力
# ====================================================================

class Lottery < ActiveRecord::Base
  self.table_name = 'lotteries'

  belongs_to :topic
  belongs_to :post
  belongs_to :user

  validates :prize_name, presence: true, length: { maximum: 100 }
  validates :prize_details, presence: true, length: { maximum: 500 }
  validates :draw_time, presence: true
  validates :winners_count, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 100 }
  validates :min_participants, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 1000 }
  validates :status, presence: true, inclusion: { in: %w[running finished cancelled] }
  validates :lottery_type, presence: true, inclusion: { in: %w[random specified] }
  validates :backup_strategy, presence: true, inclusion: { in: %w[continue cancel] }

  # 新增字段支持（安全检查）
  validates :additional_notes, length: { maximum: 300 }, allow_blank: true, if: -> { respond_to?(:additional_notes) }
  validates :prize_image, length: { maximum: 500 }, allow_blank: true, if: -> { respond_to?(:prize_image) }

  # 验证开奖时间必须是未来时间（仅在创建时）
  validate :draw_time_must_be_future, on: :create

  # 验证指定楼层格式
  validate :validate_specified_posts_format, if: -> { lottery_type == 'specified' }

  scope :running, -> { where(status: 'running') }
  scope :finished, -> { where(status: 'finished') }
  scope :cancelled, -> { where(status: 'cancelled') }
  scope :by_draw_time, -> { order(:draw_time) }
  scope :recent, -> { order(created_at: :desc) }

  def running?
    status == 'running'
  end

  def finished?
    status == 'finished'
  end

  def cancelled?
    status == 'cancelled'
  end

  def random_type?
    lottery_type == 'random'
  end

  def specified_type?
    lottery_type == 'specified'
  end

  def draw_time_passed?
    draw_time <= Time.current
  end

  def in_regret_period?
    return false unless running?
    
    lock_delay = SiteSetting.lottery_post_lock_delay_minutes.minutes
    created_at + lock_delay > Time.current
  end

  def specified_post_numbers_array
    return [] unless specified_type? && specified_post_numbers.present?
    
    specified_post_numbers.split(',').map(&:strip).map(&:to_i).select { |n| n > 0 }
  end

  def winner_users
    return [] unless finished? && winner_user_ids.present?
    
    user_ids = winner_user_ids.split(',').map(&:strip).map(&:to_i)
    User.where(id: user_ids)
  end

  # 关键修复：安全的参与者计数
  def participants_count
    return 0 unless topic.present?
    
    begin
      # 获取排除的用户组ID
      excluded_groups_setting = SiteSetting.lottery_excluded_groups || ""
      excluded_group_ids = excluded_groups_setting.split('|')
                                                  .map(&:strip)
                                                  .map(&:to_i)
                                                  .select { |id| id > 0 }
      
      query = topic.posts.where.not(post_number: 1)      # 排除主楼层
                         .where.not(user_id: user_id)     # 排除发起者
                         .where(deleted_at: nil)          # 排除已删除的帖子
                         .where(hidden: false)            # 排除隐藏的帖子

      # 排除被禁用户组的成员（安全处理）
      if excluded_group_ids.any?
        excluded_user_ids = GroupUser.where(group_id: excluded_group_ids).pluck(:user_id).uniq
        query = query.where.not(user_id: excluded_user_ids) if excluded_user_ids.any?
      end

      # 按用户去重，每个用户只计算一次
      query.distinct.count(:user_id)
    rescue => e
      Rails.logger.error "Lottery#participants_count: Error calculating count: #{e.message}"
      0
    end
  end

  def participants
    return User.none unless topic.present?
    
    begin
      # 获取有效参与者列表
      excluded_groups_setting = SiteSetting.lottery_excluded_groups || ""
      excluded_group_ids = excluded_groups_setting.split('|')
                                                  .map(&:strip)
                                                  .map(&:to_i)
                                                  .select { |id| id > 0 }
      
      query = topic.posts.joins(:user)
                         .where.not(post_number: 1)
                         .where.not(user_id: user_id)
                         .where(deleted_at: nil)
                         .where(hidden: false)

      if excluded_group_ids.any?
        excluded_user_ids = GroupUser.where(group_id: excluded_group_ids).pluck(:user_id).uniq
        query = query.where.not(user_id: excluded_user_ids) if excluded_user_ids.any?
      end

      # 返回去重的用户列表，按首次参与时间排序
      User.joins("INNER JOIN (#{query.select('MIN(posts.created_at) as first_post_time, user_id').group(:user_id).to_sql}) first_posts ON users.id = first_posts.user_id")
          .order('first_posts.first_post_time ASC')
    rescue => e
      Rails.logger.error "Lottery#participants: Error getting participants: #{e.message}"
      User.none
    end
  end

  def can_draw?
    running? && draw_time_passed?
  end

  def should_continue_with_insufficient_participants?
    backup_strategy == 'continue'
  end

  # 关键修复：格式化公告方法的安全处理
  def format_winners_announcement
    return nil unless finished? && winner_users.any?
    
    announcement = "## 🎉 开奖结果\n\n"
    announcement += "**活动名称：** #{prize_name}\n"
    announcement += "**开奖时间：** #{draw_time.strftime('%Y年%m月%d日 %H:%M')}\n\n"
    
    if specified_type?
      announcement += "**中奖方式：** 指定楼层\n"
      announcement += "**中奖名单：**\n"
      
      winner_users.each_with_index do |user, index|
        post_number = specified_post_numbers_array[index]
        announcement += "- #{post_number}楼：@#{user.username}\n"
      end
    else
      announcement += "**中奖方式：** 随机抽取\n"
      announcement += "**中奖名单：**\n"
      
      winner_users.each_with_index do |user, index|
        announcement += "#{index + 1}. @#{user.username}\n"
      end
    end
    
    announcement += "\n---\n\n"
    announcement += "🎊 恭喜以上中奖者！请及时联系活动发起者领取奖品。"
    
    announcement
  rescue => e
    Rails.logger.error "Lottery#format_winners_announcement: Error: #{e.message}"
    "开奖公告生成失败，请联系管理员。"
  end

  def format_cancellation_announcement
    announcement = "## ❌ 活动取消\n\n"
    announcement += "**活动名称：** #{prize_name}\n"
    announcement += "**取消时间：** #{Time.current.strftime('%Y年%m月%d日 %H:%M')}\n"
    announcement += "**取消原因：** 参与人数不足（需要#{min_participants}人，实际#{participants_count}人）\n\n"
    announcement += "感谢大家的关注，期待下次活动！"
    
    announcement
  rescue => e
    Rails.logger.error "Lottery#format_cancellation_announcement: Error: #{e.message}"
    "活动取消公告生成失败。"
  end

  private

  def draw_time_must_be_future
    return unless draw_time.present?
    
    if draw_time <= Time.current
      errors.add(:draw_time, "必须是未来时间")
    end
  end

  def validate_specified_posts_format
    return unless specified_post_numbers.present?
    
    begin
      numbers = specified_post_numbers_array
      
      if numbers.empty?
        errors.add(:specified_post_numbers, "指定楼层格式错误")
        return
      end
      
      if numbers.any? { |n| n <= 1 }
        errors.add(:specified_post_numbers, "楼层号必须大于1")
      end
      
      if numbers.length != numbers.uniq.length
        errors.add(:specified_post_numbers, "不能包含重复的楼层号")
      end
      
    rescue => e
      errors.add(:specified_post_numbers, "指定楼层格式错误")
    end
  end
end

# ====================================================================
# 修正 plugin.rb 中的命名空间问题
# ====================================================================

# 在 plugin.rb 的 after_initialize 块中添加以下修正：

# 修正命名空间调用
def self.extract_lottery_data_reliably(topic, opts, user)
  Rails.logger.info "LotteryPlugin: Extracting lottery data from multiple sources"
  
  lottery_data = nil
  source_info = "unknown"
  
  # 方法1：从帖子内容解析（最可靠）
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
  
  # 方法2：从opts参数获取
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
  
  # 方法3：从topic custom_fields获取
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

# ====================================================================
# 修复任务中的命名空间调用
# ====================================================================

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
        
        # 关键修复：直接从raw内容重新解析
        lottery_data = nil
        
        if raw_content.present? && raw_content.include?('[lottery]')
          lottery_match = raw_content.match(/\[lottery\](.*?)\[\/lottery\]/m)
          if lottery_match
            lottery_data = parse_lottery_content_from_raw(lottery_match[1])
          end
        end
        
        unless lottery_data
          Rails.logger.error "ProcessLotteryCreation: Failed to extract lottery data in job"
          post_error_message(topic_id, "无法解析抽奖数据，请检查格式是否正确")
          return
        end
        
        Rails.logger.debug "ProcessLotteryCreation: Using parsed data: #{lottery_data.inspect}"
        
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

    def parse_lottery_content_from_raw(content)
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
      
      data['backup_strategy'] = 'continue' unless data['backup_strategy']
      data
    end

    def normalize_lottery_data(lottery_data)
      case lottery_data
      when String
        begin
          JSON.parse(lottery_data).with_indifferent_access
        rescue JSON::ParserError
          lottery_data.with_indifferent_access if lottery_data.respond_to?(:with_indifferent_access)
        end
      when Hash
        lottery_data.with_indifferent_access
      else
        lottery_data&.with_indifferent_access if lottery_data.respond_to?(:with_indifferent_access)
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
            lottery_data = parse_lottery_content_from_raw(lottery_match[1])
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

    private

    def parse_lottery_content_from_raw(content)
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
      
      data['backup_strategy'] = 'continue' unless data['backup_strategy']
      data
    end
  end
end
