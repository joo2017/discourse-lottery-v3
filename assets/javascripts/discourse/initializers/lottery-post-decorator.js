// assets/javascripts/discourse/initializers/lottery-post-decorator.js
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-post-decorator",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 抽奖装饰器初始化");

      // 监听页面变化，订阅MessageBus消息
      api.onPageChange(() => {
        const messageBus = api.container.lookup("service:message-bus");
        if (messageBus) {
          // 获取当前主题ID
          const topicElement = document.querySelector('.topic-post article[data-topic-id]');
          const topicId = topicElement?.dataset?.topicId;
          
          if (topicId) {
            console.log("🎲 订阅主题消息:", topicId);
            
            // 订阅该主题的MessageBus消息
            messageBus.subscribe(`/topic/${topicId}`, (data) => {
              console.log("🎲 收到实时消息:", data);
              
              if (data.type === 'lottery_created' || 
                  data.type === 'lottery_updated' || 
                  data.type === 'lottery_completed') {
                
                console.log("🎲 检测到抽奖状态变化，刷新页面");
                
                // 延迟刷新，确保数据库操作完成
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              }
            });
          }
        }
      });

      // 清理原有的 [lottery] 标签显示
      api.decoratePost((element, post) => {
        if (post.post_number !== 1) return;

        // 查找并隐藏 [lottery] 标签内容
        const cookedElement = element.querySelector('.cooked');
        if (cookedElement) {
          const content = cookedElement.innerHTML;
          
          // 如果发现 [lottery] 标签，添加隐藏样式
          if (content.includes('[lottery]')) {
            const updatedContent = content.replace(
              /\[lottery\]([\s\S]*?)\[\/lottery\]/g, 
              '<div class="lottery-raw-content" style="display: none;">$&</div>'
            );
            
            if (updatedContent !== content) {
              cookedElement.innerHTML = updatedContent;
              console.log("🎲 隐藏了原始lottery标签内容");
            }
          }
        }
      });

    });
  },
};
