package com.chat.chat.Security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

@Component
public class HttpAdminRateLimitInterceptor implements HandlerInterceptor {

    private final HttpRateLimitService httpRateLimitService;

    public HttpAdminRateLimitInterceptor(HttpRateLimitService httpRateLimitService) {
        this.httpRateLimitService = httpRateLimitService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String uri = request.getRequestURI();
        if (uri == null || !uri.contains("/admin/")) {
            return true;
        }

        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String endpointKey = pattern == null ? uri : pattern.toString();
        httpRateLimitService.checkAdminEndpoint(request, endpointKey);
        return true;
    }
}
