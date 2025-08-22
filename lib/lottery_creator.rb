class Lottery < ActiveRecord::Base
  belongs_to :topic
  belongs_to :post
  belongs_to :user

  validates :prize_name, presence: true
  validates :prize_details, presence: true
  validates :draw_time, presence: true
  validates :winners_count, presence: true, numericality: { greater_than: 0 }
  validates :min_participants, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: %w[running finished cancelled] }
  validates :lottery_type, presence: true, inclusion: { in: %w[random specified] }
  validates :backup_strategy, presence: true, inclusion: { in: %w[continue cancel] }

  scope :running, -> { where(status: 'running') }
  scope :finished, -> { where(status: 'finished') }
  scope :cancelled, -> { where(status: 'cancelled') }

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
end
