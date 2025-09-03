// ====================================================================
// 修复 assets/javascripts/discourse/initializers/lottery-composer-integration.js
// ====================================================================

import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化编辑器集成 - 可靠性修复版");

      // 关键修复：确保序列化参数正确注册
      api.serializeOnCreate('lottery');
      api.serializeToDraft('lottery');
      api.serializeToTopic('lottery', 'topic.lottery');
      
      // 额外保障：注册自定义字段传递
      api.serializeOnCreate('lottery_data', 'lotteryData');

      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const siteSettings = api.container.lookup("service:site-settings");
        const allowedCategories = siteSettings?.lottery_allowed_categories;
        
        if (!allowedCategories) return true;

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          shortcut: "Ctrl+Shift+L",
          perform: (e) => {
            const siteSettings = api.container.lookup("service:site-settings");
            
            if (!siteSettings?.lottery_enabled) {
              alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能");
              return;
            }

            const modal = api.container.lookup("service:modal");
            const composer = api.container.lookup("controller:composer");
            
            modal.show(LotteryFormModal, {
              model: { 
                toolbarEvent: e,
                composer: composer,
                siteSettings: siteSettings
              }
            });
          }
        });
      });

      // 关键修复：三重保障的数据传递机制
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save 开始 - 可靠性修复版");
          
          if (typeof options !== 'object' || options === null) {
            options = {};
          }
          
          const model = this.get("model");
          const content = model.get("reply") || "";
          
          // 检查是否包含抽奖标记
          const lotteryMatch = content.match(/\[lottery\](.*?)\[\/lottery\]/s);
          
          if (lotteryMatch) {
            console.log("🎲 检测到抽奖内容标记");
            
            const lotteryData = this.extractLotteryDataFromContent(lotteryMatch[1]);
            
            if (lotteryData && this.validateLotteryData(lotteryData)) {
              console.log("🎲 解析到有效的抽奖数据:", lotteryData);
              
              // 方法1：设置到model属性（主要方式）
              model.set("lottery", JSON.stringify(lotteryData));
              
              // 方法2：设置到custom_fields（备用方式）
              if (!model.custom_fields) {
                model.set("custom_fields", {});
              }
              model.set("custom_fields.lottery", JSON.stringify(lotteryData));
              
              // 方法3：设置到opts（第三保障）
              options.lottery = JSON.stringify(lotteryData);
              
              // 方法4：设置到model.opts（第四保障）
              let modelOpts = model.get("opts");
              if (!modelOpts || typeof modelOpts !== 'object') {
                modelOpts = {};
                model.set("opts", modelOpts);
              }
              modelOpts.lottery = JSON.stringify(lotteryData);
              
              // 通知属性变更
              model.notifyPropertyChange("lottery");
              model.notifyPropertyChange("custom_fields");
              model.notifyPropertyChange("opts");
              
              console.log("🎲 抽奖数据已设置到所有传递路径");
              
              // 关键修复：在raw内容中也确保格式正确
              const cleanContent = this.ensureLotteryContentFormat(content, lotteryData);
              if (cleanContent !== content) {
                model.set("reply", cleanContent);
                console.log("🎲 已修正raw内容中的抽奖格式");
              }
            }
          }
          
          return this._super(options);
        },
        
        // 关键修复：确保内容格式标准化
        ensureLotteryContentFormat(content, lotteryData) {
          // 构建标准化的抽奖内容
          const standardLotteryContent = this.buildStandardLotteryContent(lotteryData);
          
          // 替换现有的抽奖标记内容
          return content.replace(/\[lottery\](.*?)\[\/lottery\]/s, standardLotteryContent);
        },
        
        buildStandardLotteryContent(data) {
          let content = `[lottery]\n`;
          content += `活动名称：${data.prize_name}\n`;
          content += `奖品说明：${data.prize_details}\n`;
          content += `开奖时间：${data.draw_time}\n`;
          
          if (data.specified_posts && data.specified_posts.trim()) {
            content += `指定楼层：${data.specified_posts}\n`;
          } else {
            content += `获奖人数：${data.winners_count || 1}\n`;
          }
          
          content += `参与门槛：${data.min_participants}人\n`;
          
          if (data.backup_strategy === 'cancel') {
            content += `后备策略：人数不足时取消活动\n`;
          } else {
            content += `后备策略：人数不足时继续开奖\n`;
          }
          
          if (data.additional_notes && data.additional_notes.trim()) {
            content += `补充说明：${data.additional_notes}\n`;
          }
          
          if (data.prize_image && data.prize_image.trim()) {
            content += `奖品图片：${data.prize_image}\n`;
          }
          
          content += `[/lottery]`;
          
          return content;
        },
        
        extractLotteryDataFromContent(lotteryContent) {
          console.log("🎲 解析抽奖内容:", lotteryContent);
          
          const data = {};
          const lines = lotteryContent.split('\n');
          
          lines.forEach(line => {
            line = line.trim();
            if (line && line.includes('：')) {
              const [key, value] = line.split('：', 2);
              const trimmedKey = key.trim();
              const trimmedValue = value ? value.trim() : '';
              
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
                  if (trimmedValue) {
                    data.specified_posts = trimmedValue;
                  }
                  break;
                case '参与门槛':
                  const participants = trimmedValue.match(/\d+/);
                  data.min_participants = participants ? parseInt(participants[0]) : 5;
                  break;
                case '后备策略':
                  if (trimmedValue.includes('取消')) {
                    data.backup_strategy = 'cancel';
                  } else {
                    data.backup_strategy = 'continue';
                  }
                  break;
                case '补充说明':
                  if (trimmedValue) {
                    data.additional_notes = trimmedValue;
                  }
                  break;
                case '奖品图片':
                  if (trimmedValue) {
                    data.prize_image = trimmedValue;
                  }
                  break;
              }
            }
          });
          
          console.log("🎲 解析结果:", data);
          return data;
        },
        
        validateLotteryData(data) {
          if (!data.prize_name || !data.prize_details || !data.draw_time) {
            console.log("🎲 抽奖数据验证失败：缺少必填字段");
            return false;
          }
          
          const drawDate = new Date(data.draw_time);
          if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
            console.log("🎲 抽奖数据验证失败：时间无效");
            return false;
          }
          
          console.log("🎲 抽奖数据验证通过");
          return true;
        }
      });

      // 关键修复：确保model序列化包含抽奖数据
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        serialize(serializer, dest) {
          const result = this._super(serializer, dest);
          
          // 多重保障确保序列化
          if (this.lottery) {
            result.lottery = this.lottery;
            console.log("🎲 模型序列化：包含 lottery 数据");
          }
          
          if (this.custom_fields && this.custom_fields.lottery) {
            result.lottery = this.custom_fields.lottery;
            console.log("🎲 模型序列化：从 custom_fields 包含 lottery 数据");
          }
          
          // 确保传递到后端
          if (result.lottery) {
            console.log("🎲 最终序列化数据包含 lottery:", typeof result.lottery);
          }
          
          return result;
        }
      });

      console.log("🎲 Lottery: 编辑器集成初始化完成 - 可靠性修复版");
    });
  },
};

// ====================================================================
// 修复 assets/javascripts/discourse/components/modal/lottery-form-modal.js
// ====================================================================

// lottery-form-modal.js 关键修复：确保数据正确传递到composer
export default class LotteryFormModal extends Component {
  @service modal;
  @service site;
  @service appEvents;
  @service dialog;

  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked prizeImage = "";
  @tracked prizeImagePreview = "";
  @tracked isImageUploading = false;
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";
  @tracked validationErrors = {};

  constructor(owner, args) {
    super(owner, args);
    this.initializeDefaults();
  }

  initializeDefaults() {
    this.minParticipants = this.globalMinParticipants;
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = new Date(defaultTime.getTime() - (defaultTime.getTimezoneOffset() * 60000))
                    .toISOString().slice(0, 16);
  }

  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  get isValid() {
    this.validationErrors = {};
    let isValid = true;
    if (isBlank(this.prizeName)) { isValid = false; }
    if (isBlank(this.prizeDetails)) { isValid = false; }
    if (isBlank(this.drawTime)) { isValid = false; }
    else {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime()) || drawDate <= new Date()) { isValid = false; }
    }
    if (this.minParticipants < this.globalMinParticipants) { isValid = false; }
    return isValid;
  }

  @action updatePrizeName(event) { this.prizeName = event.target.value; }
  @action updatePrizeDetails(event) { this.prizeDetails = event.target.value; }
  @action updateDrawTime(event) { this.drawTime = event.target.value; }
  @action updateWinnersCount(event) { this.winnersCount = parseInt(event.target.value, 10) || 1; }
  @action updateSpecifiedPosts(event) { this.specifiedPosts = event.target.value; }
  @action updateMinParticipants(event) { this.minParticipants = parseInt(event.target.value, 10) || this.globalMinParticipants; }
  @action updateBackupStrategy(event) { this.backupStrategy = event.target.value; }
  @action updateAdditionalNotes(event) { this.additionalNotes = event.target.value; }
  @action showFlash(message, type = "error") { this.flash = message; this.flashType = type; }
  @action clearFlash() { this.flash = ""; this.flashType = ""; }

  @action async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { return this.dialog.alert("请选择一个有效的图片文件。"); }
    if (file.size > (3 * 1024 * 1024)) { return this.dialog.alert("图片文件大小不能超过 3MB。"); }
    this.isImageUploading = true;
    this.clearFlash();
    try {
      const reader = new FileReader();
      reader.onload = (e) => { this.prizeImagePreview = e.target.result; };
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_type', 'composer');
      const response = await ajax('/uploads.json', { method: 'POST', data: formData, processData: false, contentType: false });
      if (response && response.url) {
        this.prizeImage = response.url;
        this.showFlash("图片上传成功！", "success");
      } else { throw new Error('服务器返回的上传数据格式不正确'); }
    } catch (error) {
      this.dialog.alert(`图片上传失败: ${error.message || '未知错误'}`);
      this.prizeImagePreview = "";
    } finally { this.isImageUploading = false; }
  }

  @action removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    const fileInput = document.getElementById('lottery-image-upload');
    if (fileInput) { fileInput.value = ''; }
  }

  @action async submit() {
    this.clearFlash();
    if (!this.isValid) { this.showFlash("请检查表单，确保所有必填项都已正确填写。"); return; }
    this.isLoading = true;
    try {
      const lotteryData = {
        prize_name: this.prizeName.trim(), 
        prize_details: this.prizeDetails.trim(),
        draw_time: this.drawTime.trim(), 
        winners_count: this.winnersCount,
        specified_posts: this.specifiedPosts.trim(), 
        min_participants: this.minParticipants,
        backup_strategy: this.backupStrategy, 
        additional_notes: this.additionalNotes.trim(),
        prize_image: this.prizeImage.trim()
      };
      
      const composer = this.args.model.composer;
      const model = composer.get("model");
      
      // 关键修复：多重数据设置保障
      const lotteryJSON = JSON.stringify(lotteryData);
      
      // 方法1：设置到model属性
      model.set("lottery", lotteryJSON);
      
      // 方法2：设置到自定义字段
      if (!model.custom_fields) {
        model.set("custom_fields", {});
      }
      model.set("custom_fields.lottery", lotteryJSON);
      
      // 方法3：直接构建标准化内容并插入
      const placeholder = this.buildLotteryPlaceholder(lotteryData);
      
      // 关键修复：清理现有内容中的抽奖标记，避免重复
      let currentContent = model.get("reply") || "";
      currentContent = currentContent.replace(/\[lottery\](.*?)\[\/lottery\]/gs, '').trim();
      
      // 插入新的抽奖内容
      const finalContent = currentContent + '\n\n' + placeholder;
      model.set("reply", finalContent);
      
      // 通知所有属性变更
      model.notifyPropertyChange("lottery");
      model.notifyPropertyChange("custom_fields");
      model.notifyPropertyChange("reply");
      
      console.log("🎲 抽奖数据已通过多重方式设置到composer");
      console.log("🎲 最终内容长度:", finalContent.length);
      
      this.showFlash("抽奖信息已成功插入！", "success");
      setTimeout(() => { this.args.closeModal(); }, 1000);
      
    } catch (error) {
      this.showFlash(`处理失败: ${error.message || '未知错误'}`, "error");
    } finally { this.isLoading = false; }
  }

  buildLotteryPlaceholder(lotteryData) {
    let placeholder = `[lottery]\n`;
    placeholder += `活动名称：${lotteryData.prize_name}\n`;
    placeholder += `奖品说明：${lotteryData.prize_details}\n`;
    placeholder += `开奖时间：${lotteryData.draw_time}\n`;
    if (lotteryData.specified_posts) {
      placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
    } else {
      placeholder += `获奖人数：${lotteryData.winners_count}\n`;
    }
    placeholder += `参与门槛：${lotteryData.min_participants}人\n`;
    
    if (lotteryData.backup_strategy === 'cancel') {
      placeholder += `后备策略：人数不足时取消活动\n`;
    } else {
      placeholder += `后备策略：人数不足时继续开奖\n`;
    }
    
    if (lotteryData.additional_notes) { 
      placeholder += `补充说明：${lotteryData.additional_notes}\n`; 
    }
    if (lotteryData.prize_image) { 
      placeholder += `奖品图片：${lotteryData.prize_image}\n`; 
    }
    placeholder += `[/lottery]`;
    return placeholder;
  }

  @action cancel() { this.args.closeModal(); }
}
