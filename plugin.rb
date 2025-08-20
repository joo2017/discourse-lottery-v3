# file: discourse-lottery-v3/plugin.rb

# name: discourse-lottery-v3
# about: A comprehensive and robust lottery plugin for Discourse, based on the V3 blueprint.
# version: 0.1
# authors: [Your Name]
# url: [Your GitHub Repo URL]

enabled_site_setting :lottery_enabled

# [临时修正] 我们暂时注释或删除了 register_asset "stylesheets/lottery-form.scss"
# 因为您已经删除了前端文件，所以我们也必须在这里移除对它的引用，否则编译会失败。

after_initialize do
  # Server-side logic will go here.
end
