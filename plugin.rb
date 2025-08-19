# file: discourse-lottery-v3/plugin.rb

# name: Discourse Lottery V3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# 注册前端资源，这样 Discourse 的 asset pipeline 才会编译和加载它们
register_asset "stylesheets/lottery.scss" # 我们暂时还没用到 CSS，但先注册好
register_asset "javascripts/discourse/templates/connectors/composer-after-title/lottery-form.hbs"


after_initialize do
  # ... 所有核心的后端逻辑将从这里开始挂载 ...
end
