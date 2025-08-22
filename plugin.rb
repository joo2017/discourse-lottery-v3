# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

after_initialize do
  # 直接在这里定义 Lottery 模型
  class ::Lottery < ActiveRecord::Base
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

  # 直接在这里定义 LotteryCreator
  class ::LotteryCreator
    def initialize(topic, lottery_data, user)
      @topic = topic
      @data = lottery_data
      @user = user
      @post = topic.first_post
    end

    def create
      Rails.logger.info "LotteryCreator: Starting creation for topic #{@topic.id}"
      Rails.logger.info "LotteryCreator: Data received: #{@data.inspect}"
      
      # 验证数据
      validate_data!
      
      # 智能判断抽奖方式
      determine_lottery_type!
      
      # 创建抽奖记录
      lottery = create_lottery_record!
      
      # 添加标签
      add_lottery_tag!
      
      # 在主题下发布抽奖信息
      create_lottery_post!(lottery)
      
      Rails.logger.info "LotteryCreator: Successfully created lottery #{lottery.id}"
      lottery
    end

    private

    def validate_data!
      Rails.logger.info "LotteryCreator: Validating data"
      
      required_fields = ['prize_name', 'prize_details', 'draw_time']
      missing_fields = required_fields.select { |field| @data[field].blank? }
      
      if missing_fields.any?
        raise "缺少必填字段: #{missing_fields.join(', ')}"
      end

      # 验证最小参与人数
      global_min = SiteSetting.lottery_min_participants_global
      min_participants = @data['min_participants'].to_i
      if min_participants < global_min
        raise "参与门槛不能低于#{global_min}人"
      end

      # 验证开奖时间
      begin
        draw_time = DateTime.parse(@data['draw_time'])
        if draw_time <= DateTime.current
          raise "开奖时间必须是未来时间"
        end
      rescue ArgumentError
        raise "开奖时间格式无效"
      end
      
      Rails.logger.info "LotteryCreator: Data validation passed"
    end

    def determine_lottery_type!
      if @data['specified_posts'].present?
        @lottery_type = 'specified'
        # 解析指定楼层
        posts = @data['specified_posts'].split(',').map(&:strip).select(&:present?)
        @specified_post_numbers = posts.join(',')
        @winners_count = posts.length
        Rails.logger.info "LotteryCreator: Determined type as 'specified' with posts: #{@specified_post_numbers}"
      else
        @lottery_type = 'random'
        @specified_post_numbers = nil
        @winners_count = @data['winners_count'].to_i
        Rails.logger.info "LotteryCreator: Determined type as 'random' with #{@winners_count} winners"
      end
    end

    def create_lottery_record!
      Rails.logger.info "LotteryCreator: Creating lottery record"
      
      lottery = Lottery.create!(
        topic_id: @topic.id,
        post_id: @post.id,
        user_id: @user.id,
        prize_name: @data['prize_name'],
        prize_details: @data['prize_details'],
        draw_time: DateTime.parse(@data['draw_time']),
        winners_count: @winners_count,
        min_participants: @data['min_participants'].to_i,
        backup_strategy: @data['backup_strategy'] || 'continue',
        lottery_type: @lottery_type,
        specified_post_numbers: @specified_post_numbers,
        status: 'running'
      )
      
      Rails.logger.info "LotteryCreator: Created lottery record with ID #{lottery.id}"
      lottery
    end

    def add_lottery_tag!
      begin
        lottery_tag = Tag.find_or_create_by(name: '抽奖中')
        @topic.tags << lottery_tag unless @topic.tags.include?(lottery_tag)
        Rails.logger.info "LotteryCreator: Added '抽奖中' tag"
      rescue => e
        Rails.logger.warn "LotteryCreator: Failed to add tag: #{e.message}"
      end
    end

    def create_lottery_post!(lottery)
      Rails.logger.info "LotteryCreator: Creating lottery info post"
      
      lottery_info = build_lottery_info_text(lottery)
      
      post = PostCreator.create!(
        Discourse.system_user,
        topic_id: @topic.id,
        raw: lottery_info
      )
      
      Rails.logger.info "LotteryCreator: Created lottery info post with ID #{post.id}"
      post
    end

    def build_lottery_info_text(lottery)
      info = <<~TEXT
        ## 🎲 抽奖活动信息

        **活动名称：** #{lottery.prize_name}
        **奖品说明：** #{lottery.prize_details}
        **开奖时间：** #{lottery.draw_time.strftime('%Y年%m月%d日 %H:%M')}
        **参与门槛：** 至少需要 #{lottery.min_participants} 人参与
        **后备策略：** #{lottery.backup_strategy == 'continue' ? '人数不足时继续开奖' : '人数不足时取消活动'}

      TEXT

      if lottery.lottery_type == 'specified'
        info += "**抽奖方式：** 指定楼层 (#{lottery.specified_post_numbers})\n"
        info += "**获奖楼层：** #{lottery.specified_post_numbers}\n\n"
      else
        info += "**抽奖方式：** 随机抽取\n"
        info += "**获奖人数：** #{lottery.winners_count} 人\n\n"
      end

      info += "---\n\n"
      info += "💡 **参与方式：** 在本话题下回复即可参与抽奖\n\n"
      info += "🏷️ **活动状态：** 进行中"

      info
    end
  end
  
  # 定义模型关联
  Topic.class_eval do
    has_many :lotteries, dependent: :destroy
  end
  
  # 监听话题创建事件
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    Rails.logger.info "LotteryPlugin: Topic created, checking for lottery data"
    
    # 检查是否有抽奖数据
    lottery_data = topic.custom_fields['lottery']
    if lottery_data.present?
      Rails.logger.info "LotteryPlugin: Found lottery data: #{lottery_data}"
      begin
        parsed_data = JSON.parse(lottery_data)
        Rails.logger.info "LotteryPlugin: Parsed data: #{parsed_data.inspect}"
        LotteryCreator.new(topic, parsed_data, user).create
      rescue => e
        Rails.logger.error "LotteryPlugin: Failed to create lottery: #{e.message}"
        Rails.logger.error "LotteryPlugin: Backtrace: #{e.backtrace.join("\n")}"
        # 在主题下发布错误消息
        PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: "抽奖创建失败：#{e.message}。请联系管理员。"
        )
      end
    else
      Rails.logger.info "LotteryPlugin: No lottery data found in custom_fields"
    end
  end
end
