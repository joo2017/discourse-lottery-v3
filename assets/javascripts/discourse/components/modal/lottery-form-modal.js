// assets/javascripts/discourse/components/modal/lottery-form-modal.js
import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryFormModal extends Component {
  @service modal;
  @service site;

  // 表单数据（使用 @tracked 进行响应式更新）
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
  
  // 状态管理
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";

  constructor(owner, args) {
    super(owner, args);
    console.log("🎲 抽奖表单模态框组件初始化");
    console.log("🎲 传入的模型数据:", this.args.model);
    
    // 初始化最小参与人数
    this.minParticipants = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    
    // 设置默认开奖时间（1小时后）
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = defaultTime.toISOString().slice(0, 16);

    // 注册全局引用（用于数据获取）
    window.currentLotteryForm = this;

    console.log("🎲 初始化完成，默认开奖时间:", this.drawTime);
    console.log("🎲 最小参与人数:", this.minParticipants);
  }

  // 清理时移除全局引用
  willDestroy() {
    super.willDestroy();
    if (window.currentLotteryForm === this) {
      window.currentLotteryForm = null;
    }
  }

  // 表单验证
  get isValid() {
    const hasRequiredFields = this.prizeName.trim() && 
                             this.prizeDetails.trim() && 
                             this.drawTime.trim();
    const hasValidMinParticipants = this.minParticipants >= this.globalMinParticipants;
    
    const valid = hasRequiredFields && hasValidMinParticipants;
    
    return valid;
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  // 获取当前表单数据（供外部调用）
  getLotteryData() {
    if (!this.isValid) return null;
    
    return {
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
  }

  // 显示 flash 消息
  @action
  showFlash(message, type = "error") {
    console.log("🎲 显示 flash 消息:", message, type);
    this.flash = message;
    this.flashType = type;
  }

  // 清除 flash 消息
  @action
  clearFlash() {
    this.flash = "";
    this.flashType = "";
  }

  // 更新表单字段的方法
  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    this.clearFlash();
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    this.clearFlash();
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    this.clearFlash();
  }

  @action
  updateWinnersCount(event) {
    this.winnersCount = parseInt(event.target.value) || 1;
  }

  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
  }

  @action
  updateMinParticipants(event) {
    const num = parseInt(event.target.value) || 0;
    this.minParticipants = Math.max(num, this.globalMinParticipants);
    this.clearFlash();
  }

  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
  }

  // 处理图片上传
  @action
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      this.showFlash("请选择图片文件", "error");
      return;
    }

    // 验证文件大小 (3MB)
    if (file.size > 3 * 1024 * 1024) {
      this.showFlash("图片文件大小不能超过 3MB", "error");
      return;
    }

    this.isImageUploading = true;
    console.log("🎲 开始上传图片:", file.name);

    try {
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        this.prizeImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);

      // 使用 Discourse 的上传 API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'composer');

      const response = await fetch('/uploads.json', {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.prizeImage = data.url;
        console.log("🎲 图片上传成功:", this.prizeImage);
        this.showFlash("图片上传成功", "success");
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error("🎲 图片上传失败:", error);
      this.showFlash("图片上传失败，请重试", "error");
      this.prizeImagePreview = "";
    } finally {
      this.isImageUploading = false;
    }
  }

  // 移除图片
  @action
  removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    console.log("🎲 移除图片");
  }

  // === 核心提交方法（使用官方推荐方式） ===
  @action
  async submit() {
    console.log("🎲 开始提交抽奖表单 - 使用官方Custom Fields方法");
    this.clearFlash();

    if (!this.isValid) {
      this.showFlash("请填写所有必填字段");
      return;
    }

    // 验证时间格式和有效性
    try {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime())) {
        this.showFlash("开奖时间格式无效");
        return;
      }
      if (drawDate <= new Date()) {
        this.showFlash("开奖时间必须是未来时间");
        return;
      }
      
      // 检查是否至少30分钟后
      const minTime = new Date(Date.now() + 30 * 60 * 1000);
      if (drawDate < minTime) {
        this.showFlash("开奖时间至少要在30分钟之后");
        return;
      }
    } catch (e) {
      this.showFlash("开奖时间格式无效");
      return;
    }

    // 验证参与门槛
    if (this.minParticipants < this.globalMinParticipants) {
      this.showFlash(`参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`);
      return;
    }

    this.isLoading = true;
    console.log("🎲 开始处理表单提交，设置加载状态");

    try {
      // 构建抽奖数据对象
      const lotteryData = this.getLotteryData();
      console.log("🎲 构建的抽奖数据对象:", lotteryData);

      // === 官方推荐方式：缓存数据供初始化器使用 ===
      window.lotteryFormDataCache = lotteryData;
      console.log("🎲 数据已缓存到 window.lotteryFormDataCache");

      // 获取composer实例
      const composer = this.args.model?.composer;
      console.log("🎲 获取编辑器实例:", composer);
      
      if (composer && composer.get) {
        // 直接设置抽奖数据到composer模型（官方推荐方式）
        const model = composer.get('model');
        if (model) {
          console.log("🎲 找到composer模型，直接设置抽奖数据");
          model.set('lottery_data', lotteryData);
          model.set('lottery_status', 'running');
          
          // 通知属性变更（触发序列化）
          model.notifyPropertyChange('lottery_data');
          model.notifyPropertyChange('lottery_status');
          
          console.log("🎲 已将抽奖数据设置到composer模型");
        }

        // 构建占位符内容（用于用户查看）
        let placeholder = this.buildPlaceholderContent(lotteryData);
        
        // 插入占位符到编辑器内容
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);

        console.log("🎲 抽奖占位符成功插入到编辑器");
        console.log("🎲 插入的完整占位符:", placeholder);
        
        // 显示成功消息
        this.showFlash("抽奖信息已插入编辑器，发布主题后抽奖将自动生效", "success");
        
        // 延迟关闭模态框，让用户看到成功提示
        setTimeout(() => {
          console.log("🎲 关闭模态框");
          this.args.closeModal();
        }, 1500);
      } else {
        console.error("🎲 无法获取编辑器实例");
        this.showFlash("无法获取编辑器，请刷新页面重试");
      }
    } catch (error) {
      console.error("🎲 提交表单时发生错误:", error);
      this.showFlash("提交失败：" + error.message);
    } finally {
      this.isLoading = false;
      console.log("🎲 清除加载状态");
    }
  }

  // 构建占位符内容的辅助方法
  buildPlaceholderContent(lotteryData) {
    let placeholder = `\n[lottery]\n`;
    placeholder += `活动名称：${lotteryData.prize_name}\n`;
    placeholder += `奖品说明：${lotteryData.prize_details}\n`;
    placeholder += `开奖时间：${lotteryData.draw_time}\n`;
    
    // 智能判断抽奖方式
    if (lotteryData.specified_posts && lotteryData.specified_posts.trim()) {
      placeholder += `抽奖方式：指定楼层\n`;
      placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
    } else {
      placeholder += `抽奖方式：随机抽取\n`;
      placeholder += `获奖人数：${lotteryData.winners_count}\n`;
    }
    
    placeholder += `参与门槛：${lotteryData.min_participants}人\n`;
    placeholder += `后备策略：${lotteryData.backup_strategy === 'continue' ? '人数不足时继续开奖' : '人数不足时取消活动'}\n`;
    
    // 补充说明（如果有）
    if (lotteryData.additional_notes && lotteryData.additional_notes.trim()) {
      placeholder += `补充说明：${lotteryData.additional_notes}\n`;
    }
    
    // 奖品图片（如果有）
    if (lotteryData.prize_image && lotteryData.prize_image.trim()) {
      placeholder += `奖品图片：${lotteryData.prize_image}\n`;
    }
    
    placeholder += `[/lottery]\n\n`;
    
    return placeholder;
  }

  // 取消操作
  @action
  cancel() {
    console.log("🎲 用户取消抽奖表单");
    this.args.closeModal();
  }
}
