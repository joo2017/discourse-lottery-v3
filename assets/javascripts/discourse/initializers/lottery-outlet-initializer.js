// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-outlet-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import { hbs } from "ember-cli-htmlbars";

export default {
  name: "lottery-outlet-initializer",
  initialize(container) {
    withPluginApi("1.0.0", (api) => {
      // 使用最新的、官方推荐的 renderInOutlet API
      api.renderInOutlet('composer-fields', outletArgs => {
        const siteSettings = container.lookup('service:site-settings');
        
        if (!siteSettings.lottery_enabled) { return; }

        const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
        const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
        
        // outletArgs 直接就是 composer model
        const model = outletArgs;

        // 核心判断逻辑
        if (model.action === 'createTopic' && allowedCategories.includes(model.categoryId)) {
          // 直接返回一个 hbs 模板，调用我们的组件
          // 这种方式不会破坏编辑器，因为它是由 Discourse 的渲染引擎安全处理的
          return hbs`<LotteryForm @model={{model}} @siteSettings={{siteSettings}} />`;
        }
      });

      // 保留最小化的 save 方法修改
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        save(options) {
          const lotteryData = this.get("model.lotteryFormData");
          if (lotteryData) {
            this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
          }
          return this._super(options);
        },
      });
    });
  },
};
