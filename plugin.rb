# file: discourse-lottery-v3/plugin.rb

# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册 SCSS 样式文件
register_asset "stylesheets/lottery-form.scss"

after_initialize do
  # Server-side logic will go here.
end
