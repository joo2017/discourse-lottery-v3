# file: discourse-lottery-v3/plugin.rb

# name: Discourse Lottery V3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

# 核心修正：我们已经删除了错误的 `load` 语句。
# Discourse会自动加载 config/settings.yml 文件。

enabled_site_setting :lottery_enabled

after_initialize do
  # ... 后续代码将在此处添加 ...
end
