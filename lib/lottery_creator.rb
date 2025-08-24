class LotteryCreator
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
    Rails.logger.info "LotteryCreator: Raw data: #{@data}"
    
    required_fields = ['prize_name', 'prize_details', 'draw_time']
    missing_fields = required_fields.select { |field| @data[field].blank? }
    
    if missing_fields.any?
      error_msg = "缺少必填字段: #{missing_fields.join(', ')}"
      Rails.logger.error "LotteryCreator: #{error_msg}"
      raise error_msg
    end

    # 验证最小参与人数 - 修复这里的逻辑
    global_min = SiteSetting.lottery_min_participants_global
    min_participants = @data['min_participants']
    
    Rails.logger.info "LotteryCreator: Global min: #{global_min}, User input: #{min_participants} (#{min_participants.class})"
    
    # 确保转换为整数进行比较
    user_min = min_participants.to_i
    global_min_int = global_min.to_i
    
    Rails.logger.info "LotteryCreator: Comparing #{user_min} >= #{global_min_int}"
    
    if user_min < global_min_int
      error_msg = "参与门槛不能低于#{global_min_int}人"
      Rails.logger.error "LotteryCreator: #{error_msg}"
      raise error_msg
    end

    # 验证开奖时间
    begin
      draw_time = DateTime.parse(@data['draw_time'])
      if draw_time <= DateTime.current
        error_msg = "开奖时间必须是未来时间"
        Rails.logger.error "LotteryCreator: #{error_msg}"
        raise error_msg
      end
    rescue ArgumentError => e
      error_msg = "开奖时间格式无效: #{e.message}"
      Rails.logger.error "LotteryCreator: #{error_msg}"
      raise error_msg
    end
    
    Rails.logger.info "LotteryCreator: Data validation passed"
  end

  def determine_lottery_type!
    Rails.logger.info "LotteryCreator: Determining lottery type"
    Rails.logger.info "LotteryCreator: Specified posts value: '#{@data['specified_posts']}'"
    
    if @data['specified_posts'].present? && @data['specified_posts'].strip.present?
      @lottery_type = 'specified'
      # 解析指定楼层
      posts = @data['specified_posts'].split(',').map(&:strip).select(&:present?)
      @specified_post_numbers = posts.join(',')
      @winners_count = posts.length
      Rails.logger.info "LotteryCreator: Determined type as 'specified' with posts: #{@specified_post_numbers}, winners: #{@winners_count}"
    else
      @lottery_type = 'random'
      @specified_post_numbers = nil
      @winners_count = @data['winners_count'].to_i
      Rails.logger.info "LotteryCreator: Determined type as 'random' with #{@winners_count} winners"
    end
  end

  def create_lottery_record!
    Rails.logger.info "LotteryCreator: Creating lottery record"
    
    lottery_params = {
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
    }
    
    Rails.logger.info "LotteryCreator: Creating with params: #{lottery_params}"
    
    lottery = Lottery.create!(lottery_params)
    
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
      ## 🎲 抽奖活动已创建

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
    info += "🏷️ **活动状态：** 进行中\n\n"
    info += "📊 **抽奖记录ID：** #{lottery.id}"

    info
  end
end
