// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-outlet-initializer.js.es6

// 核心修正：从 @ember/string 中导入 htmlSafe，用于安全地渲染组件
import { htmlSafe } from "@ember/string";
import { withPluginApi } from "discourse/lib/plugin-api";
// 核心修正：导入 hbs 模板编译函数
import { hbs } from "ember-cli-htmlbars";

export default {
  name: "lottery-outlet-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 核心修正：使用最新的 api.renderInOutlet 写法
      api.renderInOutlet("composer-fields", (outletArgs) => {
        // outletArgs 就是 composer 的 model，我们可以从中获取 categoryId
        const model = outletArgs;
        const siteSettings = api.container.lookup("service:site-settings");
        
        if (!siteSettings.lottery_enabled) {
          return;
        }
        
        const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
        const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
        
        // 在这里进行最核心的判断
        if (model.action === "createTopic" && allowedCategories.includes(model.categoryId)) {
          // 核心修正：返回一个编译好的 hbs 模板，调用我们的组件
          // `model=model` 是将 composer 的 model 传递给我们的组件
          return hbs`{{lottery-form model=model}}`;
        }
      });

      // 我们仍然需要一个极小化的 modifyClass 来处理保存数据的逻辑
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
