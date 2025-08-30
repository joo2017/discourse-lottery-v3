// assets/javascripts/discourse/components/modal/lottery-form-modal.js
import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service"; // 官方推荐方式
import { isBlank, isPresent } from "@ember/utils";
import { ajax } from "discourse/lib/ajax";

export default class LotteryFormModal extends Component {
  @service modal;
  @service site;
  @service appEvents;

  // 表单数据
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
  @tracked validationErrors = {};

  constructor(owner, args) {
    super(owner, args);
    this.initializeDefaults();
  }

  initializeDefaults() {
    const globalMin = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    this.minParticipants = globalMin;
    
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000)
                    .toISOString().slice(0, 16);
  }

  get isValid() {
    this.validationErrors = {};
    let isValid = true;

    if (isBlank(this.prizeName)) {
      this.validationErrors.prizeName = "活动名称不能为空";
      isValid = false;
    } else if (this.prizeName.length > 100) {
      this.validationErrors.prizeName = "活动名称不能超过100个字符";
      isValid = false;
    }

    if (isBlank(this.prizeDetails)) {
      this.validationErrors.prizeDetails = "奖品说明不能为空";
      isValid = false;
    } else if (this.prizeDetails.length > 500) {
      this.validationErrors.prizeDetails = "奖品说明不能超过500个字符";
      isValid = false;
    }

    if (isBlank(this.drawTime)) {
      this.validationErrors.drawTime = "开奖时间不能为空";
      isValid = false;
    } else {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime())) {
        this.validationErrors.drawTime = "开奖时间格式无效";
        isValid = false;
      } else if (drawDate <= new Date()) {
        this.validationErrors.drawTime = "开奖时间必须是未来时间";
        isValid = false;
      }
    }

    if (this.minParticipants < this.globalMinParticipants) {
      this.validationErrors.minParticipants = `参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`;
      isValid = false;
    }

    if (this.winnersCount < 1 || this.winnersCount > 100) {
      this.validationErrors.winnersCount = "获奖人数必须在1-100之间";
      isValid = false;
    }

    if (isPresent(this.specifiedPosts)) {
      const posts = this.specifiedPosts.split(',').map(p => p.trim()).filter(p => p);
      const numbers = posts.map(p => parseInt(p)).filter(n => !isNaN(n) && n > 1);
      
      if (posts.length !== numbers.length || numbers.length === 0) {
        this.validationErrors.specifiedPosts = "指定楼层格式错误";
        isValid = false;
      } else if (numbers.length !== [...new Set(numbers)].length) {
        this.validationErrors.specifiedPosts = "指定楼层不能包含重复数字";
        isValid = false;
      }
    }

    if (isPresent(this.additionalNotes) && this.additionalNotes.length > 300) {
      this.validationErrors.additionalNotes = "补充说明不能超过300个字符";
      isValid = false;
    }
    
    return isValid;
  }

  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  @action
  showFlash(message, type = "error") {
    this.flash = message;
    this.flashType = type;
    
    if (type === "success") {
      setTimeout(() => {
        this.clearFlash();
      }, 3000);
    }
  }

  @action
  clearFlash() {
    this.flash = "";
    this.flashType = "";
  }

  // 更新表单字段
  @action updatePrizeName(event) {
    this.prizeName = event.target.value;
    this.clearFlash();
    delete this.validationErrors.prizeName;
  }

  @action updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    this.clearFlash();
    delete this.validationErrors.prizeDetails;
  }

  @action updateDrawTime(event) {
    this.drawTime = event.target.value;
    this.clearFlash();
    delete this.validationErrors.drawTime;
  }

  @action updateWinnersCount(event) {
    const value = parseInt(event.target.value);
    this.winnersCount = isNaN(value) ? 1 : Math.max(1, Math.min(100, value));
    delete this.validationErrors.winnersCount;
  }

  @action updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
    delete this.validationErrors.specifiedPosts;
  }

  @action updateMinParticipants(event) {
    const value = parseInt(event.target.value);
    this.minParticipants = isNaN(value) ? this.globalMinParticipants : Math.max(value, this.globalMinParticipants);
    this.clearFlash();
    delete this.validationErrors.minParticipants;
  }

  @action updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  @action updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
    delete this.validationErrors.additionalNotes;
  }

  @action
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showFlash("请选择图片文件", "error");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      this.showFlash("图片文件大小不能超过 3MB", "error");
      return;
    }

    this.isImageUploading = true;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.prizeImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_type', 'composer');

      const response = await ajax('/uploads.json', {
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false
      });

      if (response && response.url) {
        this.prizeImage = response.url;
        this.showFlash("图片上传成功", "success");
      } else {
        throw new Error('上传响应格式错误');
      }
    } catch (error) {
      this.showFlash("图片上传失败，请重试", "error");
      this.prizeImagePreview = "";
    } finally {
      this.isImageUploading = false;
    }
  }

  @action
  removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    const fileInput = document.getElementById('lottery-image-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // 官方推荐：使用标准的数据传递方式
  @action
  async submit() {
    this.clearFlash();

    if (!this.isValid) {
      const firstErrorKey = Object.keys(this.validationErrors)[0];
      const firstError = this.validationErrors[firstErrorKey];
      this.showFlash(firstError, "error");
      return;
    }

    this.isLoading = true;

    try {
      // 构建抽奖数据
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

      const composer = this.args.model?.composer;
      
      if (composer && composer.get) {
        const model = composer.get("model");
        
        // 官方推荐：使用 custom_fields 传递数据到 PostCreator
        if (!model.custom_fields) {
          model.set("custom_fields", {});
        }
        
        // 设置数据到 custom_fields，这将被 add_permitted_post_create_param 处理
        model.set("custom_fields.lottery", JSON.stringify(lotteryData));
        model.notifyPropertyChange("custom_fields");
        
        // 构建显示内容
        const placeholder = this.buildLotteryPlaceholder(lotteryData);
        const currentText = model.get("reply") || "";
        model.set("reply", currentText + placeholder);

        this.showFlash("抽奖信息已插入编辑器", "success");
        
        setTimeout(() => {
          this.args.closeModal();
        }, 1500);
      } else {
        throw new Error("无法获取编辑器实例");
      }
    } catch (error) {
      this.showFlash("提交失败：" + error.message, "error");
    } finally {
      this.isLoading = false;
    }
  }

  buildLotteryPlaceholder(lotteryData) {
    let placeholder = `\n[lottery]\n`;
    placeholder += `活动名称：${lotteryData.prize_name}\n`;
    placeholder += `奖品说明：${lotteryData.prize_details}\n`;
    placeholder += `开奖时间：${lotteryData.draw_time}\n`;
    
    if (lotteryData.specified_posts && lotteryData.specified_posts.trim()) {
      placeholder += `抽奖方式：指定楼层\n`;
      placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
    } else {
      placeholder += `抽奖方式：随机抽取\n`;
      placeholder += `获奖人数：${lotteryData.winners_count}\n`;
    }
    
    placeholder += `参与门槛：${lotteryData.min_participants} 人\n`;
    
    if (lotteryData.additional_notes && lotteryData.additional_notes.trim()) {
      placeholder += `补充说明：${lotteryData.additional_notes}\n`;
    }
    
    if (lotteryData.prize_image && lotteryData.prize_image.trim()) {
      placeholder += `奖品图片：${lotteryData.prize_image}\n`;
    }
    
    placeholder += `[/lottery]\n\n`;
    return placeholder;
  }

  @action
  cancel() {
    this.args.closeModal();
  }
}
