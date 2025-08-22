# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

after_initialize do
  # 加载模型
  require_relative 'lib/lottery_creator'
  
  # 监听话题创建事件
  DiscourseEvent.on(:topic_created) do |topic, opts, user|
    next unless SiteSetting.lottery_enabled
    
    # 检查是否有抽奖数据
    lottery_data = topic.custom_fields['lottery']
    if lottery_data.present?
      begin
        parsed_data = JSON.parse(lottery_data)
        LotteryCreator.new(topic, parsed_data, user).create
      rescue => e
        Rails.logger.error "Failed to create lottery: #{e.message}"
        # 在主题下发布错误消息
        PostCreator.create!(
          Discourse.system_user,
          topic_id: topic.id,
          raw: "抽奖创建失败：#{e.message}。请联系管理员。"
        )
      end
    end
  end

  # 扩展话题序列化器，添加抽奖信息
  add_to_serializer(:topic_view, :lottery_info) do
    lottery = object.topic.lotteries.first
    if lottery
      {
        id: lottery.id,
        prize_name: lottery.prize_name,
        prize_details: lottery.prize_details,
        draw_time: lottery.draw_time,
        winners_count: lottery.winners_count,
        min_participants: lottery.min_participants,
        status: lottery.status,
        lottery_type: lottery.lottery_type,
        specified_post_numbers: lottery.specified_post_numbers,
        backup_strategy: lottery.backup_strategy
      }
    end
  end

  # 指定何时包含抽奖信息
  add_to_serializer(:topic_view, :include_lottery_info?) do
    object.topic.lotteries.exists?
  end
end
