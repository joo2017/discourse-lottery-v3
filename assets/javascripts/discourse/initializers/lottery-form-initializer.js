import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 Lottery form initializer loaded");
      
      // 官方推荐：不需要修改 composer 或 topic 模型
      // customFields 会自动传递到后端
      
      // 监听话题创建成功
      api.onAppEvent("topic:created", (topicData) => {
        console.log("🎲 Topic created successfully:", topicData.id);
        
        // 延迟刷新显示结果
        setTimeout(() => {
          console.log("🎲 Refreshing to show lottery display");
          window.location.reload();
        }, 3000);
      });
    });
  },
};
