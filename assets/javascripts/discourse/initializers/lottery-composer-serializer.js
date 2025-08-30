// assets/javascripts/discourse/initializers/lottery-composer-serializer.js
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-composer-serializer",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 抽奖编辑器序列化器初始化");

      // 关键修复：确保抽奖数据正确序列化到请求参数中
      api.serializeOnCreate('lottery');
      api.serializeToTopic('lottery', 'topic.lottery');
      
      // 扩展 composer 模型，确保数据正确传递
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        // 重写序列化方法，确保 lottery 数据被包含
        serialize(serializer, dest) {
          const result = this._super(serializer, dest);
          
          console.log("🎲 序列化 composer 模型");
          console.log("🎲 当前 custom_fields:", this.custom_fields);
          console.log("🎲 当前 lottery 属性:", this.get('lottery'));
          
          // 确保 lottery 数据被正确添加到序列化结果中
          if (this.custom_fields && this.custom_fields.lottery) {
            result.lottery = this.custom_fields.lottery;
            console.log("🎲 从 custom_fields 添加 lottery 数据:", result.lottery);
          }
          
          if (this.get('lottery')) {
            result.lottery = this.get('lottery');
            console.log("🎲 从属性添加 lottery 数据:", result.lottery);
          }
          
          // 额外确保：如果有 opts，也添加 lottery 数据
          const opts = this.get('opts');
          if (opts && opts.lottery) {
            result.lottery = opts.lottery;
            console.log("🎲 从 opts 添加 lottery 数据:", result.lottery);
          }
          
          console.log("🎲 最终序列化结果 lottery:", result.lottery);
          
          return result;
        }
      });

      // 修改 composer 控制器，确保创建时传递正确参数
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save 方法被调用");
          
          const model = this.get("model");
          console.log("🎲 检查模型数据:");
          console.log("  - custom_fields:", model.custom_fields);
          console.log("  - lottery 属性:", model.get('lottery'));
          console.log("  - opts:", model.get('opts'));
          
          // 确保在保存前，lottery 数据被正确设置
          if (model.custom_fields && model.custom_fields.lottery) {
            // 将 custom_fields 中的 lottery 数据提升到顶级属性
            model.set('lottery', model.custom_fields.lottery);
            console.log("🎲 将 lottery 数据提升到顶级属性");
            
            // 同时确保在 creatingTopic 时，数据会被包含在请求中
            if (model.get('creatingTopic')) {
              const currentOpts = model.get('opts') || {};
              currentOpts.lottery = model.custom_fields.lottery;
              model.set('opts', currentOpts);
              console.log("🎲 确保 lottery 数据包含在 opts 中");
            }
          }
          
          return this._super(options);
        }
      });

      // 扩展 PostCreator 参数处理
      api.addPostCreatedCallback((post, opts) => {
        console.log("🎲 Post 创建回调触发");
        console.log("🎲 回调参数 opts:", opts);
        
        if (opts && opts.lottery) {
          console.log("🎲 发现 lottery 数据在 opts 中:", opts.lottery);
        }
      });

      console.log("🎲 抽奖编辑器序列化器初始化完成");
    });
  },
};
