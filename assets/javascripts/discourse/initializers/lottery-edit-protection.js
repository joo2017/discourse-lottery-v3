// assets/javascripts/discourse/initializers/lottery-edit-protection.js
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-edit-protection",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      // 监听编辑器显示事件
      api.onPageChange(() => {
        // 检查是否是编辑抽奖主题
        const composer = api.container.lookup("controller:composer");
        if (!composer) return;
        
        const model = composer.get("model");
        if (!model || model.get("action") !== "edit") return;
        
        const topic = model.get("topic");
        if (!topic) return;
        
        // 检查是否是抽奖主题
        const hasLotteryTag = topic.tags && topic.tags.some(tag => 
          tag.name === "抽奖中" || tag.name === "已开奖" || tag.name === "已取消"
        );
        
        if (hasLotteryTag) {
          console.log("检测到抽奖主题编辑");
          
          // 检查是否在后悔期内
          const post = model.get("post");
          if (post && post.get("locked")) {
            // 显示锁定提示
            composer.set("model.reply", composer.get("model.reply"));
            
            // 添加编辑提示
            setTimeout(() => {
              const editorContainer = document.querySelector(".d-editor-container");
              if (editorContainer && !editorContainer.querySelector(".lottery-edit-warning")) {
                const warning = document.createElement("div");
                warning.className = "lottery-edit-warning alert alert-warning";
                warning.innerHTML = `
                  <strong>⚠️ 抽奖主题编辑提醒</strong><br>
                  此主题包含抽奖活动，已过编辑保护期。如需修改抽奖信息，请联系管理员。
                `;
                editorContainer.insertBefore(warning, editorContainer.firstChild);
              }
            }, 100);
          } else {
            // 在后悔期内，可以编辑
            setTimeout(() => {
              const editorContainer = document.querySelector(".d-editor-container");
              if (editorContainer && !editorContainer.querySelector(".lottery-edit-tip")) {
                const tip = document.createElement("div");
                tip.className = "lottery-edit-tip alert alert-info";
                tip.innerHTML = `
                  <strong>💡 抽奖主题编辑提示</strong><br>
                  您正在编辑包含抽奖活动的主题。请注意：修改后的抽奖信息将在保存后自动更新。
                `;
                editorContainer.insertBefore(tip, editorContainer.firstChild);
              }
            }, 100);
          }
        }
      });

      // 扩展编辑器保存逻辑
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          const model = this.get("model");
          
          // 检查是否是抽奖主题的编辑
          if (model.get("action") === "edit" && model.get("post.post_number") === 1) {
            const topic = model.get("topic");
            const hasLotteryTag = topic?.tags?.some(tag => 
              tag.name === "抽奖中" || tag.name === "已开奖" || tag.name === "已取消"
            );
            
            if (hasLotteryTag) {
              console.log("保存抽奖主题编辑");
              
              // 检查内容中是否有新的抽奖数据
              const content = model.get("reply");
              const lotteryMatch = content.match(/\[lottery\](.*?)\[\/lottery\]/s);
              
              if (lotteryMatch) {
                console.log("检测到编辑后的抽奖内容");
                
                // 解析抽奖数据并保存到 custom_fields
                const lotteryContent = lotteryMatch[1];
                const parsedData = this.parseLotteryContent(lotteryContent);
                
                if (parsedData && Object.keys(parsedData).length > 0) {
                  if (!model.custom_fields) {
                    model.set("custom_fields", {});
                  }
                  model.set("custom_fields.lottery", JSON.stringify(parsedData));
                  model.notifyPropertyChange("custom_fields");
                  
                  console.log("已更新编辑后的抽奖数据到 custom_fields");
                }
              }
            }
          }
          
          return this._super(options);
        },
        
        // 解析抽奖内容的方法
        parseLotteryContent(content) {
          const data = {};
          const lines = content.split('\n');
          
          lines.forEach(line => {
            line = line.trim();
            if (line.includes('：')) {
              const [key, value] = line.split('：', 2);
              const trimmedKey = key.trim();
              const trimmedValue = value.trim();
              
              switch (trimmedKey) {
                case '活动名称':
                  data.prize_name = trimmedValue;
                  break;
                case '奖品说明':
                  data.prize_details = trimmedValue;
                  break;
                case '开奖时间':
                  data.draw_time = trimmedValue;
                  break;
                case '获奖人数':
                  data.winners_count = parseInt(trimmedValue) || 1;
                  break;
                case '指定楼层':
                  data.specified_posts = trimmedValue;
                  break;
                case '参与门槛':
                  data.min_participants = parseInt(trimmedValue.replace(/[^\d]/g, '')) || 1;
                  break;
                case '补充说明':
                  data.additional_notes = trimmedValue;
                  break;
                case '奖品图片':
                  data.prize_image = trimmedValue;
                  break;
              }
            }
          });
          
          return data;
        }
      });
    });
  },
};
