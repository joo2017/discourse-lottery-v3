// assets/javascripts/discourse/initializers/lottery-composer-serializer.js
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-composer-serializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 抽奖编辑器序列化器初始化");

      // 修改 composer 控制器，确保创建时传递正确参数
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save 方法被调用");
          
          const model = this.get("model");
          console.log("🎲 检查模型数据:");
          console.log("  - custom_fields:", model.custom_fields);
          
          // 确保在保存前，lottery 数据被正确设置到 custom_fields
          if (model.custom_fields && model.custom_fields.lottery) {
            console.log("🎲 发现 lottery 数据，确保正确传递");
            
            // 通知模型属性变化，确保序列化时包含 custom_fields
            model.notifyPropertyChange("custom_fields");
          }
          
          return this._super(options);
        }
      });

      console.log("🎲 抽奖编辑器序列化器初始化完成");
    });
  },
};
