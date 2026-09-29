FROM nginx:alpine

# Default port fallback (Cloud Run supplies PORT=8080 automatically)
ENV PORT=8080

# Clean out default static files
RUN rm -rf /usr/share/nginx/html/*

# Copy site static assets
COPY site/ /usr/share/nginx/html/

# Copy Nginx template (nginx:alpine automatically substitutes $PORT using envsubst)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
