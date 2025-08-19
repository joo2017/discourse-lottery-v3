# file: discourse-lottery-v3/plugin.rb (最终修正版)

# name: Discourse Lottery V3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

after_initialize do
  # ... 所有核心的后端逻辑将从这里开始挂载 ...
end
