from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from api.models import Transformer, TransformerMeasurement, CustomUser, SupportSession, SupportMessage, AdminNotification
from django.utils.translation import gettext_lazy as _

class CustomUserAdmin(UserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (_("Personal info"), {"fields": ("first_name", "last_name", "email", "phone", "dateOfBirth", "company")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "password1", "password2"),
            },
        ),
    )
    list_display = ("username", "email", "first_name", "last_name", "is_staff")

class SupportMessageInline(admin.TabularInline):
    model = SupportMessage
    extra = 0
    readonly_fields = ('sender', 'content', 'timestamp', 'is_read')

class SupportSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'created_at', 'updated_at', 'is_resolved')
    list_filter = ('is_resolved', 'created_at', 'user')
    search_fields = ('user__username', 'title')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [SupportMessageInline]

class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'session', 'content_preview', 'timestamp', 'is_read')
    list_filter = ('is_read', 'timestamp', 'sender')
    search_fields = ('sender__username', 'content')
    readonly_fields = ('timestamp',)
    
    def content_preview(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'

class AdminNotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message_preview', 'created_at', 'is_read')
    list_filter = ('is_read', 'created_at', 'user')
    search_fields = ('user__username', 'message__content')
    readonly_fields = ('created_at',)
    
    def message_preview(self, obj):
        return obj.message.content[:50] + "..." if len(obj.message.content) > 50 else obj.message.content
    message_preview.short_description = 'Message Content'

# Register your models here.
admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Transformer)
admin.site.register(TransformerMeasurement)
admin.site.register(SupportSession, SupportSessionAdmin)
admin.site.register(SupportMessage, SupportMessageAdmin)
admin.site.register(AdminNotification, AdminNotificationAdmin)
