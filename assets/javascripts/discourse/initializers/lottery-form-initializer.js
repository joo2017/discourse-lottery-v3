import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 修改 composer 控制器来保存抽奖数据
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        actions: {
          save(options) {
            // 获取抽奖表单数据
            const lotteryComponent = this.get("_lotteryFormComponent");
            if (lotteryComponent && lotteryComponent.formData) {
              // 将抽奖数据保存到 custom_fields
              this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryComponent.formData));
            }
            return this._super(options);
          }
        }
      });

      // 修改抽奖表单组件，添加注册功能
      api.modifyClass("component:lottery-form", {
        pluginId: "discourse-lottery-v3",
        
        didInsertElement() {
          this._super(...arguments);
          // 注册组件到 composer 控制器
          const composer = this.get("targetObject");
          if (composer) {
            composer.set("_lotteryFormComponent", this);
          }
        },

        willDestroyElement() {
          this._super(...arguments);
          // 清理注册
          const composer = this.get("targetObject");
          if (composer) {
            composer.set("_lotteryFormComponent", null);
          }
        }
      });
    });
  },
};
