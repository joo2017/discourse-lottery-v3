// assets/javascripts/discourse/initializers/lottery-form-initializer.js
// 基于官方Discourse文档的推荐方法

import { withPluginApi } from "discourse/lib/plugin-api";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖初始化器 - 官方推荐方法");

      // === 第一步：使用官方API注册字段序列化 ===
      // 这是官方推荐的确保字段传递到后端的方法
      api.serializeOnCreate('lottery_data');
      api.serializeOnCreate('lottery_status');  
      api.serializeOnCreate('lottery_creator_id');
      api.serializeOnCreate('lottery_created_at');
      
      // 支持草稿保存
      api.serializeToDraft('lottery_data');
      api.serializeToDraft('lottery_status');
      
      // 支持主题编辑
      api.serializeToTopic('lottery_data', 'topic.lottery_data');
      api.serializeToTopic('lottery_status', 'topic.lottery_status');

      console.log("🎲 已注册官方字段序列化");

      // === 第二步：扩展Topic模型（前端同步） ===
      api.modifyClass('model:topic', {
        pluginId: 'discourse-lottery-v3-official',

        // 使用computed属性（官方推荐）
        hasLottery: computed('lottery_data', function() {
          return this.lottery_data && Object.keys(this.lottery_data).length > 0;
        }),

        lotteryStatus: computed('lottery_status', function() {
          return this.lottery_status || 'none';
        }),

        isLotteryActive: computed('lottery_status', function() {
          return this.lottery_status === 'running';
        }),

        // 格式化的抽奖信息（用于显示）
        formattedLotteryInfo: computed('lottery_data', 'lottery_status', function() {
          const data = this.lottery_data;
          if (!data) return null;
          
          return {
            prizeName: data.prize_name,
            drawTime: data.draw_time,
            status: this.lottery_status,
            isActive: this.lottery_status === 'running',
            winnersCount: data.winners_count || 1,
            minParticipants: data.min_participants
          };
        })
      });

      console.log("🎲 已扩展Topic模型");

      // === 第三步：使用官方推荐的save钩子方法 ===
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3-official",

        // 只在save方法中设置数据，不重写serialize
        save(options) {
          console.log("🎲 Composer save - 官方方法");
          
          const model = this.get("model");
          
          // 检查是否有抽奖数据需要保存
          let lotteryDataToSave = this.extractLotteryData();
          
          if (lotteryDataToSave) {
            console.log("🎲 发现抽奖数据，使用官方方法设置");
            
            // 官方推荐：直接设置到模型属性，让API序列化处理
            model.set('lottery_data', lotteryDataToSave);
            model.set('lottery_status', 'running');
            model.set('lottery_creator_id', this.currentUser?.id);
            model.set('lottery_created_at', new Date().toISOString());
            
            // 通知属性变更（触发官方序列化）
            model.notifyPropertyChange('lottery_data');
            model.notifyPropertyChange('lottery_status');
            model.notifyPropertyChange('lottery_creator_id');
            model.notifyPropertyChange('lottery_created_at');
            
            console.log("🎲 抽奖数据设置完成，交由官方API处理");
            
            // 清理缓存
            this.cleanupLotteryCache();
          }

          // 调用父类方法，让官方的序列化和保存逻辑处理
          return this._super(options).then((result) => {
            console.log("🎲 保存成功:", result);
            return result;
          }).catch((error) => {
            console.error("🎲 保存失败:", error);
            // 如果保存失败且有抽奖数据，保留缓存以便用户重试
            if (lotteryDataToSave) {
              window.lotteryFormDataCache = lotteryDataToSave;
              console.log("🎲 保存失败，已保留抽奖数据缓存");
            }
            throw error;
          });
        },

        // 提取抽奖数据的辅助方法
        extractLotteryData() {
          let lotteryData = null;
          
          // 优先从缓存获取（模态框提交的数据）
          if (window.lotteryFormDataCache) {
            const cache = window.lotteryFormDataCache;
            console.log("🎲 从缓存提取抽奖数据");
            
            // 验证缓存数据
            if (this.validateLotteryData(cache)) {
              lotteryData = cache;
            } else {
              console.warn("🎲 缓存数据验证失败");
            }
          }
          
          // 备选：从全局组件引用获取
          else if (window.currentLotteryForm) {
            console.log("🎲 从组件引用提取抽奖数据");
            const componentData = window.currentLotteryForm.getLotteryData();
            
            if (componentData && this.validateLotteryData(componentData)) {
              lotteryData = componentData;
            }
          }
          
          return lotteryData;
        },

        // 验证抽奖数据的辅助方法
        validateLotteryData(data) {
          if (!data || typeof data !== 'object') return false;
          
          const requiredFields = ['prize_name', 'prize_details', 'draw_time', 'min_participants'];
          return requiredFields.every(field => 
            data[field] !== undefined && 
            data[field] !== null && 
            String(data[field]).trim() !== ''
          );
        },

        // 清理缓存的辅助方法
        cleanupLotteryCache() {
          window.lotteryFormDataCache = null;
          if (window.currentLotteryForm) {
            window.currentLotteryForm = null;
          }
          console.log("🎲 已清理抽奖数据缓存");
        }
      });

      console.log("🎲 已扩展Composer控制器");

      // === 第四步：应用事件监听（官方推荐） ===
      
      // 监听主题创建成功事件
      api.onAppEvent('topic:created', (data) => {
        console.log("🎲 主题创建成功事件:", data);
        if (data && (data.lottery_data || data.hasLottery)) {
          console.log("🎲 抽奖主题创建成功");
          
          // 可以在这里添加成功后的处理逻辑
          // 比如显示成功提示、跳转等
        }
      });

      // 监听保存错误事件
      api.onAppEvent('composer:save-error', (error) => {
        console.warn("🎲 保存出错:", error);
        
        // 如果有抽奖数据，提供特殊的错误处理
        if (window.lotteryFormDataCache) {
          console.log("🎲 保存出错但有抽奖数据，数据已保留供重试");
        }
      });

      // === 第五步：MessageBus监听（实时更新） ===
      
      // 监听抽奖相关的实时消息
      api.onPageChange((url, title) => {
        const topicMatch = url.match(/\/t\/[^\/]+\/(\d+)/);
        if (topicMatch) {
          const topicId = topicMatch[1];
          
          // 订阅该主题的抽奖更新消息
          api.messageBus.subscribe(`/topic/${topicId}`, (data) => {
            if (data.type === 'lottery_created') {
              console.log("🎲 收到抽奖创建通知:", data);
              
              // 可以在这里更新UI，显示抽奖信息等
              // 比如刷新页面或动态插入抽奖组件
            }
          });
        }
      });

      // === 第六步：调试和监控工具（生产环境安全） ===
      
      // 生产环境安全的调试工具
      window.debugLotteryOfficial = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) {
          console.log("🎲 未找到Composer");
          return false;
        }
        
        const model = composer.get('model');
        
        console.log("🎲 官方方法状态检查:");
        console.log("  📋 基本信息:");
        console.log("    - 标题:", model.get('title'));
        console.log("    - 内容长度:", model.get('reply')?.length || 0);
        console.log("    - 分类:", model.get('categoryId'));
        
        console.log("  🎲 抽奖信息:");
        console.log("    - lottery_data:", !!model.get('lottery_data'));
        console.log("    - lottery_status:", model.get('lottery_status'));
        console.log("    - 缓存数据:", !!window.lotteryFormDataCache);
        
        console.log("  ✅ 状态:");
        const isReady = !!(model.get('title') && model.get('reply') && model.get('categoryId'));
        const hasLottery = !!model.get('lottery_data');
        
        console.log("    - 基本字段完整:", isReady);
        console.log("    - 包含抽奖数据:", hasLottery);
        console.log("    - 可以发布:", isReady);
        
        return { isReady, hasLottery };
      };

      // 验证API序列化的工具
      window.testLotteryAPI = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) return false;
        
        const model = composer.get('model');
        
        console.log("🎲 API序列化测试:");
        
        // 模拟设置抽奖数据
        const testData = {
          prize_name: "测试抽奖",
          prize_details: "这是一个测试",
          draw_time: new Date(Date.now() + 86400000).toISOString(),
          min_participants: 5,
          winners_count: 1,
          backup_strategy: "continue"
        };
        
        model.set('lottery_data', testData);
        model.set('lottery_status', 'running');
        model.notifyPropertyChange('lottery_data');
        model.notifyPropertyChange('lottery_status');
        
        console.log("🎲 测试数据已设置，模型状态:");
        console.log("  - lottery_data:", model.get('lottery_data'));
        console.log("  - lottery_status:", model.get('lottery_status'));
        
        return true;
      };

      console.log("🎲 抽奖初始化器完成 - 官方推荐方法");
      console.log("🎲 调试工具: window.debugLotteryOfficial(), window.testLotteryAPI()");
    });
  },
};
