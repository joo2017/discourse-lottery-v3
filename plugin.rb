# plugin.rb 序列化器部分修复版本
after_initialize do
  Rails.logger.info "LotteryPlugin: Starting initialization"

  # ===================================================================
  # 扩展序列化器 (修正版本)
  # ===================================================================
  
  # 扩展 TopicViewSerializer
  add_to_serializer(:topic_view, :lottery_data, include_condition: -> {
    # 检查 topic 是否存在并且有抽奖记录
    object.topic&.lotteries&.exists?
  }) do
    lottery = object.topic.lotteries.first
    return nil unless lottery

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
      prize_image: lottery.prize_image
    }
  end

  # 扩展 PostSerializer
  add_to_serializer(:post, :lottery_data, include_condition: -> {
    # 只为主楼层显示抽奖数据
    object.post_number == 1 && object.topic&.lotteries&.exists?
  }) do
    lottery = object.topic.lotteries.first
    return nil unless lottery

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
      prize_image: lottery.prize_image
    }
  end
  
  Rails.logger.info "LotteryPlugin: Serializers extended"
  
  # ... 其余代码保持不变 ...
end
