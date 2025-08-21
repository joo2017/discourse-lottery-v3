// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-form-initializer.js

import { withPluginApi } from "discourse/lib/plugin-api";
import { A } from "@ember/array";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi(" lotteryData = this.get("model.lotteryFormData");
          if (lotteryData) {
            this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
          }
          1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginreturn this._super(options);
        },
      });
    });
    ```
    **代码变更解析 (这是最终的正确方案):**
    1.  **使用 `apiInitializer`:** 这是比 `exportId: "discourse-lottery-v3",

        // 这是一个计算属性，当依赖的值变化时，它 default { initialize() ... }` 更现代、执行时机更合适的写法。
    2.  **使用会自动重新计算
        shouldShowLotteryForm: computed('model.categoryId', 'model.action', function () {
          const siteSettings = this.siteSettings;
          if (!siteSettings.lottery_enabled) `api.registerConnectorClass`:** 这是专门用于“插件出口”的、**不会产生任何弃用警告** {
            return false;
          }

          const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";的最新API。它完美地替代了 `decoratePluginOutlet` 和 `renderInOutlet`。
    3.
          const allowedCategories = A(allowedCategoriesSetting.split('|').map(Number).filter(id => id >  **清晰的职责:**
        *   第一个参数 `'composer-fields'` 是出口名称。
        *   第二个参数 `'lottery-form'` 是我们给这个连接起的名字。
        *   `shouldRender` 函数 0));
          const currentCategoryId = this.get('model.categoryId');

          return this.get('model.action') === 'createTopic' &&
                 !allowedCategories.isEmpty() &&
                 allowedCategories.includes(currentCategoryId);
        }),
        
        // 保存逻辑
        save(options) {
          const lottery专门负责判断逻辑。
        *   `component: LotteryForm` 直接指定了要渲染的组件。
        *   这个结构清晰、强大，并且是 100%面向未来的。

#### **第三步：其他Data = this.get("model.lotteryFormData");
          if (lotteryData) {
            this文件保持不变**

我们之前最终版的 `lottery-form.js` 和 `lottery-form.hbs` (Glimmer组件版) 是完全正确的，**它们不需要任何修改**。

---

### **下一步.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
          }
          return this._super(options);
        },
      });
    });
  },
};
