package com.chat.chat.Configuracion;

import com.chat.chat.Security.HttpAdminRateLimitInterceptor;
import com.chat.chat.Security.SqlInjectionHttpParamInterceptor;
import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final SqlInjectionHttpParamInterceptor sqlInjectionHttpParamInterceptor;
    private final HttpAdminRateLimitInterceptor httpAdminRateLimitInterceptor;

    public WebConfig(SqlInjectionHttpParamInterceptor sqlInjectionHttpParamInterceptor,
                     HttpAdminRateLimitInterceptor httpAdminRateLimitInterceptor) {
        this.sqlInjectionHttpParamInterceptor = sqlInjectionHttpParamInterceptor;
        this.httpAdminRateLimitInterceptor = httpAdminRateLimitInterceptor;
    }

    @Value("${app.uploads.root:uploads}")
    private String uploadsRoot;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadsPath = Paths.get(uploadsRoot).toAbsolutePath().normalize();
        registry.addResourceHandler(Constantes.UPLOADS_PATTERN)
                .addResourceLocations("file:" + uploadsPath.toString() + "/");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(sqlInjectionHttpParamInterceptor);
        registry.addInterceptor(httpAdminRateLimitInterceptor);
    }

}

