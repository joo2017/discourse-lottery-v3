# lib/lottery_manager.rb
class LotteryManager
  attr_reader :lottery

  def initialize(lottery)
    @lottery = lottery
  end

  def execute_draw
    Rails.logger.info "LotteryManager: Starting draw for lottery #{lottery.id}"
    
    # 状态检查
    unless lottery.can_draw?
      Rails.logger.warn "LotteryManager: Lottery #{lottery.id} cannot be drawn (status: #{lottery.status})"
      return { success: false, reason: 'lottery_not_ready' }
    end

    ActiveRecord::Base.transaction do
      # 计算有效参与者
      participants = calculate_valid_participants
      participant_count = participants.count
      
      Rails.logger.info "LotteryManager: Found #{participant_count} valid participants (required: #{lottery.min_participants})"

      # 判断是否满足参与门槛
      if participant_count >= lottery.min_participants
        # 执行开奖
        result = execute_actual_draw(participants)
        
        if result[:success]
          # 发布中奖公告
          publish_winner_announcement(result[:winners])
          
          # 发送私信通知
          send_winner_notifications(result[:winners])
          
          # 更新标签
          update_topic_tag('已开奖')
          
          # 锁定主题
          lock_topic
          
          Rails.logger.info "LotteryManager: Successfully completed draw for lottery #{lottery.id}"
          return { success: true, winners: result[:winners], participants: participant_count }
        else
          return result
        end
      else
        # 参与人数不足，根据策略处理
        Rails.logger.info "LotteryManager: Insufficient participants, applying backup strategy: #{lottery.backup_strategy}"
        
        if lottery.should_continue_with_insufficient_participants?
          # 继续开奖
          result = execute_actual_draw(participants)
          
          if result[:success]
            publish_insufficient_but_continued_announcement(result[:winners], participant_count)
            send_winner_notifications(result[:winners])
            update_topic_tag('已开奖')
            lock_topic
            
            Rails.logger.info "LotteryManager: Completed draw with insufficient participants"
            return { success: true, winners: result[:winners], participants: participant_count, insufficient: true }
          else
            return result
          end
        else
          # 取消活动
          cancel_lottery(participant_count)
          
          Rails.logger.info "LotteryManager: Cancelled lottery due to insufficient participants"
          return { success: true, cancelled: true, participants: participant_count }
        end
      end
    end
  rescue => e
    Rails.logger.error "LotteryManager: Draw failed for lottery #{lottery.id}: #{e.message}"
    Rails.logger.error "LotteryManager: #{e.backtrace.join("\n")}"
    
    # 标记为失败状态
    lottery.update!(status: 'cancelled')
    
    return { success: false, reason: 'execution_error', error: e.message }
  end

  private

  def calculate_valid_participants
    Rails.logger.debug "LotteryManager: Calculating valid participants"
    
    # 获取排除的用户组ID
    excluded_group_ids = SiteSetting.lottery_excluded_groups.split('|').map(&:to_i).select { |id| id > 0 }
    
    # 构建基础查询
    posts_query = lottery.topic.posts
                         .where.not(post_number: 1)        # 排除主楼层
                         .where.not(user_id: lottery.user_id) # 排除发起者
                         .where(deleted_at: nil)           # 排除已删除帖子
                         .where.not(hidden: true)          # 排除隐藏帖子
                         .joins(:user)                     # 关联用户表
                         .where(users: { active: true })   # 只包含活跃用户
    
    # 排除被禁用户组的成员
    if excluded_group_ids.any?
      excluded_user_ids = GroupUser.where(group_id: excluded_group_ids).pluck(:user_id).uniq
      if excluded_user_ids.any?
        posts_query = posts_query.where.not(user_id: excluded_user_ids)
      end
    end

    # 按用户分组，取每个用户最早的有效回复作为参与凭证
    user_first_posts = posts_query.select('DISTINCT ON (posts.user_id) posts.user_id, posts.created_at, posts.post_number')
                                 .order('posts.user_id, posts.created_at ASC')

    # 返回参与用户列表，按参与时间排序
    User.joins("INNER JOIN (#{user_first_posts.to_sql}) first_posts ON users.id = first_posts.user_id")
        .select('users.*, first_posts.post_number, first_posts.created_at as participation_time')
        .order('first_posts.created_at ASC')
  end

  def execute_actual_draw(participants)
    Rails.logger.debug "LotteryManager: Executing actual draw"
    
    if lottery.specified_type?
      return execute_specified_draw(participants)
    else
      return execute_random_draw(participants)
    end
  end

  def execute_random_draw(participants)
    Rails.logger.debug "LotteryManager: Executing random draw"
    
    participants_array = participants.to_a
    available_count = participants_array.length
    
    if available_count == 0
      lottery.update!(status: 'cancelled')
      return { success: false, reason: 'no_participants' }
    end

    # 确定实际中奖人数
    actual_winners_count = [lottery.winners_count, available_count].min
    
    # 随机选择中奖者
    winners = participants_array.sample(actual_winners_count)
    
    # 保存中奖结果
    winner_ids = winners.map(&:id).join(',')
    lottery.update!(
      status: 'finished',
      winner_user_ids: winner_ids
    )
    
    Rails.logger.info "LotteryManager: Random draw completed, #{winners.length} winners selected"
    
    { success: true, winners: winners }
  end

  def execute_specified_draw(participants)
    Rails.logger.debug "LotteryManager: Executing specified draw"
    
    specified_numbers = lottery.specified_post_numbers_array
    participants_by_post = {}
    
    # 建立楼层号到参与者的映射
    participants.each do |participant|
      post_number = participant.post_number
      participants_by_post[post_number] = participant
    end
    
    winners = []
    valid_numbers = []
    
    # 检查每个指定楼层
    specified_numbers.each do |post_number|
      if participants_by_post[post_number]
        winners << participants_by_post[post_number]
        valid_numbers << post_number
      else
        Rails.logger.warn "LotteryManager: Specified post #{post_number} not found or invalid"
      end
    end
    
    if winners.empty?
      # 所有指定楼层都无效，取消抽奖
      lottery.update!(status: 'cancelled')
      Rails.logger.warn "LotteryManager: All specified posts invalid, cancelling"
      return { success: false, reason: 'all_specified_invalid' }
    end
    
    # 保存中奖结果
    winner_ids = winners.map(&:id).join(',')
    lottery.update!(
      status: 'finished',
      winner_user_ids: winner_ids,
      specified_post_numbers: valid_numbers.join(',')  # 更新为实际有效的楼层
    )
    
    Rails.logger.info "LotteryManager: Specified draw completed, #{winners.length}/#{specified_numbers.length} winners selected"
    
    { success: true, winners: winners }
  end

  def publish_winner_announcement(winners)
    Rails.logger.debug "LotteryManager: Publishing winner announcement"
    
    announcement = build_winner_announcement(winners)
    
    PostCreator.create!(
      Discourse.system_user,
      topic_id: lottery.topic_id,
      raw: announcement
    )
  end

  def publish_insufficient_but_continued_announcement(winners, actual_count)
    Rails.logger.debug "LotteryManager: Publishing insufficient but continued announcement"
    
    announcement = "## 🎉 开奖结果\n\n"
    announcement += "**活动名称：** #{lottery.prize_name}\n"
    announcement += "**开奖时间：** #{lottery.draw_time.strftime('%Y年%m月%d日 %H:%M')}\n\n"
    announcement += "⚠️ **特别说明：** 实际参与人数为 #{actual_count} 人，少于设定门槛 #{lottery.min_participants} 人，但根据活动设置继续开奖。\n\n"
    
    if lottery.specified_type?
      announcement += "**中奖方式：** 指定楼层\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        post_number = lottery.specified_post_numbers_array[index]
        announcement += "- #{post_number}楼：@#{winner.username}\n"
      end
    else
      announcement += "**中奖方式：** 随机抽取\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        announcement += "#{index + 1}. @#{winner.username}\n"
      end
    end
    
    announcement += "\n---\n\n"
    announcement += "🎊 恭喜以上中奖者！请及时联系活动发起者领取奖品。"
    
    PostCreator.create!(
      Discourse.system_user,
      topic_id: lottery.topic_id,
      raw: announcement
    )
  end

  def build_winner_announcement(winners)
    announcement = "## 🎉 开奖结果\n\n"
    announcement += "**活动名称：** #{lottery.prize_name}\n"
    announcement += "**开奖时间：** #{lottery.draw_time.strftime('%Y年%m月%d日 %H:%M')}\n"
    announcement += "**参与人数：** #{lottery.participants_count} 人\n\n"
    
    if lottery.specified_type?
      announcement += "**中奖方式：** 指定楼层\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        # 从更新后的楼层列表获取
        post_numbers = lottery.specified_post_numbers_array
        post_number = post_numbers[index]
        announcement += "- #{post_number}楼：@#{winner.username}\n"
      end
    else
      announcement += "**中奖方式：** 随机抽取\n"
      announcement += "**中奖名单：**\n"
      
      winners.each_with_index do |winner, index|
        announcement += "#{index + 1}. @#{winner.username}\n"
      end
    end
    
    announcement += "\n---\n\n"
    announcement += "🎊 恭喜以上中奖者！请及时联系活动发起者领取奖品。"
    
    announcement
  end

  def send_winner_notifications(winners)
    Rails.logger.debug "LotteryManager: Sending winner notifications"
    
    winners.each do |winner|
      begin
        PostCreator.create!(
          Discourse.system_user,
          title: "🎉 恭喜您中奖了！",
          raw: build_winner_notification_message(winner),
          target_usernames: winner.username,
          archetype: Archetype.private_message
        )
        
        Rails.logger.debug "LotteryManager: Sent notification to #{winner.username}"
      rescue => e
        Rails.logger.error "LotteryManager: Failed to send notification to #{winner.username}: #{e.message}"
      end
    end
  end

  def build_winner_notification_message(winner)
    message = "恭喜您在抽奖活动中获奖！\n\n"
    message += "**活动名称：** #{lottery.prize_name}\n"
    message += "**奖品说明：** #{lottery.prize_details}\n"
    message += "**开奖时间：** #{lottery.draw_time.strftime('%Y年%m月%d日 %H:%M')}\n"
    message += "**活动发起者：** @#{lottery.user.username}\n\n"
    message += "请及时联系活动发起者领取您的奖品。\n\n"
    message += "[点击查看抽奖主题](#{Discourse.base_url}/t/#{lottery.topic.slug}/#{lottery.topic_id})"
    
    message
  end

  def cancel_lottery(participant_count)
    Rails.logger.debug "LotteryManager: Cancelling lottery"
    
    lottery.update!(status: 'cancelled')
    
    announcement = "## ❌ 活动取消\n\n"
    announcement += "**活动名称：** #{lottery.prize_name}\n"
    announcement += "**原定开奖时间：** #{lottery.draw_time.strftime('%Y年%m月%d日 %H:%M')}\n"
    announcement += "**取消时间：** #{Time.current.strftime('%Y年%m月%d日 %H:%M')}\n"
    announcement += "**取消原因：** 参与人数不足\n"
    announcement += "**需要人数：** #{lottery.min_participants} 人\n"
    announcement += "**实际人数：** #{participant_count} 人\n\n"
    announcement += "感谢大家的关注和参与，期待下次活动！"
    
    PostCreator.create!(
      Discourse.system_user,
      topic_id: lottery.topic_id,
      raw: announcement
    )
    
    update_topic_tag('已取消')
  end

  def update_topic_tag(new_tag_name)
    Rails.logger.debug "LotteryManager: Updating topic tag to #{new_tag_name}"
    
    begin
      topic = lottery.topic
      
      # 移除旧的抽奖相关标签
      old_tags = ['抽奖中', '已开奖', '已取消']
      old_tags.each do |tag_name|
        tag = Tag.find_by(name: tag_name)
        if tag && topic.tags.include?(tag)
          topic.tags.delete(tag)
        end
      end
      
      # 添加新标签
      new_tag = Tag.find_or_create_by!(name: new_tag_name)
      topic.tags << new_tag unless topic.tags.include?(new_tag)
      
      topic.save!
      
      Rails.logger.debug "LotteryManager: Updated tag successfully"
    rescue => e
      Rails.logger.warn "LotteryManager: Failed to update tag: #{e.message}"
    end
  end

  def lock_topic
    Rails.logger.debug "LotteryManager: Locking topic"
    
    begin
      topic = lottery.topic
      topic.update!(closed: true)
      
      Rails.logger.debug "LotteryManager: Topic locked successfully"
    rescue => e
      Rails.logger.warn "LotteryManager: Failed to lock topic: #{e.message}"
    end
  end
end
