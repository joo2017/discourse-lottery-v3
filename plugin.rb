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
  # 加载模型和服务
  require_relative 'lib/lottery'
  require_relative 'lib/lottery_creator'
  
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
