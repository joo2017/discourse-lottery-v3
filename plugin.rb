# file: discourse-lottery-v3/plugin.rb

# name: Discourse Lottery V3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

# 注册并加载我们的站点配置文件
load File.expand_path('config/settings.yml', __dir__)

enabled_site_setting :lottery_enabled

after_initialize do
  # ... 后续代码将在此处添加 ...
end
