# lib/lottery.rb
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

  # 新增字段支持
  validates :additional_notes, length: { maximum: 300 }, allow_blank: true
  validates :prize_image, length: { maximum: 500 }, allow_blank: true

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

  def participants_count
    return 0 unless topic.present?
    
    # 计算有效参与者数量
    excluded_group_ids = SiteSetting.lottery_excluded_groups.split('|').map(&:to_i)
    
    query = topic.posts.where.not(post_number: 1) # 排除主楼层
                      .where.not(user_id: user_id)  # 排除发起者
                      .where(deleted_at: nil)       # 排除已删除的帖子
                      .where.not(hidden: true)      # 排除隐藏的帖子

    # 排除被禁用户组的成员
    if excluded_group_ids.any?
      excluded_user_ids = GroupUser.where(group_id: excluded_group_ids).pluck(:user_id)
      query = query.where.not(user_id: excluded_user_ids) if excluded_user_ids.any?
    end

    # 按用户去重，每个用户只计算一次
    query.distinct.count(:user_id)
  end

  def participants
    return User.none unless topic.present?
    
    # 获取有效参与者列表
    excluded_group_ids = SiteSetting.lottery_excluded_groups.split('|').map(&:to_i)
    
    query = topic.posts.joins(:user)
                      .where.not(post_number: 1)
                      .where.not(user_id: user_id)
                      .where(deleted_at: nil)
                      .where.not(hidden: true)

    if excluded_group_ids.any?
      excluded_user_ids = GroupUser.where(group_id: excluded_group_ids).pluck(:user_id)
      query = query.where.not(user_id: excluded_user_ids) if excluded_user_ids.any?
    end

    # 返回去重的用户列表，按首次参与时间排序
    User.joins("INNER JOIN (#{query.select('MIN(posts.created_at) as first_post_time, user_id').group(:user_id).to_sql}) first_posts ON users.id = first_posts.user_id")
        .order('first_posts.first_post_time ASC')
  end

  def can_draw?
    running? && draw_time_passed?
  end

  def should_continue_with_insufficient_participants?
    backup_strategy == 'continue'
  end

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
  end

  def format_cancellation_announcement
    announcement = "## ❌ 活动取消\n\n"
    announcement += "**活动名称：** #{prize_name}\n"
    announcement += "**取消时间：** #{Time.current.strftime('%Y年%m月%d日 %H:%M')}\n"
    announcement += "**取消原因：** 参与人数不足（需要#{min_participants}人，实际#{participants_count}人）\n\n"
    announcement += "感谢大家的关注，期待下次活动！"
    
    announcement
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
